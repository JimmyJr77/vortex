const PHASE_ORDER = [
  'prepare_access',
  'skill_movement_intelligence',
  'output',
  'capacity',
  'control_resilience',
  'fitness_repeatability',
  'restore',
]

function phaseIndex(key) {
  const idx = PHASE_ORDER.indexOf(key)
  return idx >= 0 ? idx : 999
}

function itemSeconds(item) {
  const sets = Number(item.sets) || 1
  const work = Number(item.work_seconds ?? item.est_seconds_per_set) || 45
  const rest = Number(item.rest_seconds) || 0
  return sets * work + sets * rest
}

function blockSeconds(block) {
  const rounds = Number(block.rounds) || 1
  const itemsSeconds = (block.items ?? []).reduce((sum, item) => sum + itemSeconds(item), 0)
  const restBetween = Number(block.rest_between_rounds_seconds) || 0
  return rounds * itemsSeconds + restBetween * Math.max(rounds - 1, 0)
}

function computePriorFatigue(blockMeta, blockIndex, profileByExercisePhase, regimenByExercise) {
  let priorFatigue = 0
  for (let j = 0; j < blockIndex; j++) {
    const priorPhase = blockMeta[j].phaseKey
    if (priorPhase === 'fitness_repeatability') priorFatigue = Math.max(priorFatigue, 4)
    if (priorPhase === 'capacity') priorFatigue = Math.max(priorFatigue, 3)
    for (const pi of blockMeta[j].block.items ?? []) {
      const exerciseId = Number(pi.exercise_id ?? pi.exerciseId)
      if (!exerciseId || !priorPhase) continue
      const profile = profileByExercisePhase.get(`${exerciseId}:${priorPhase}`)
      const regimen = regimenByExercise.get(String(exerciseId))
      if (profile) priorFatigue = Math.max(priorFatigue, Number(profile.fatigue_cost) || 0)
      if (regimen?.counts_as_conditioning) priorFatigue = Math.max(priorFatigue, 4)
      if (regimen?.counts_as_high_intensity) priorFatigue = Math.max(priorFatigue, 3)
      priorFatigue = Math.max(priorFatigue, Number(pi.fatigue_cost) || 0)
    }
  }
  return priorFatigue
}

function computeCoverage(blockMeta, tagRows, taxonomyKeys) {
  const coverage = { tenets: {}, methodologies: {}, physiology: {} }
  for (const facetType of ['tenet', 'methodology', 'physiology']) {
    for (const key of taxonomyKeys[facetType] ?? []) {
      coverage[facetType === 'tenet' ? 'tenets' : facetType === 'methodology' ? 'methodologies' : 'physiology'][key] = 0
    }
  }
  for (const meta of blockMeta) {
    for (const item of meta.block.items ?? []) {
      const exerciseId = Number(item.exercise_id ?? item.exerciseId)
      if (!exerciseId) continue
      for (const tag of tagRows.filter((t) => String(t.exercise_id) === String(exerciseId))) {
        const bucket = tag.facet_type === 'tenet' ? 'tenets' : tag.facet_type === 'methodology' ? 'methodologies' : tag.facet_type === 'physiology' ? 'physiology' : null
        if (!bucket || !tag.facet_key) continue
        coverage[bucket][tag.facet_key] = (coverage[bucket][tag.facet_key] ?? 0) + Number(tag.weight || 1)
      }
    }
  }
  return coverage
}

function computeFatigueSummary(blockMeta, profileByExercisePhase, regimenByExercise) {
  let neural = 0
  let impact = 0
  let tissue = 0
  let conditioning = 0
  for (const meta of blockMeta) {
    for (const item of meta.block.items ?? []) {
      const exerciseId = Number(item.exercise_id ?? item.exerciseId)
      if (!exerciseId) continue
      const regimen = regimenByExercise.get(String(exerciseId))
      const profile = meta.phaseKey ? profileByExercisePhase.get(`${exerciseId}:${meta.phaseKey}`) : null
      if (regimen?.counts_as_neural) neural += 2
      if (regimen?.counts_as_high_impact || (profile && Number(profile.impact_level) >= 4)) impact += 2
      if (regimen?.counts_as_tissue_stress) tissue += 2
      if (regimen?.counts_as_conditioning) conditioning += 3
      if (profile) {
        neural = Math.max(neural, Number(profile.freshness_required) ? 1 : 0)
        impact = Math.max(impact, Number(profile.impact_level) || 0)
      }
    }
  }
  return { neural_load: neural, impact_load: impact, tissue_stress: tissue, conditioning_load: conditioning }
}

function computeTimeSummary(blockMeta, budgetMinutes) {
  const plannedSeconds = blockMeta.reduce((sum, m) => sum + blockSeconds(m.block), 0)
  const budgetSeconds = (Number(budgetMinutes) || 0) * 60
  return {
    planned_seconds: plannedSeconds,
    budget_seconds: budgetSeconds,
    delta_seconds: budgetSeconds > 0 ? plannedSeconds - budgetSeconds : 0,
    planned_minutes: Math.round(plannedSeconds / 60),
    budget_minutes: budgetMinutes ?? null,
  }
}

export async function validateWorkoutDraft(pool, draft) {
  const errors = []
  const warnings = []
  const recommendations = []

  const phaseRows = await pool.query(`SELECT id, key, name, order_index FROM coaching.session_phase ORDER BY order_index`)
  const phaseById = new Map(phaseRows.rows.map((p) => [String(p.id), p]))
  const phaseByKey = new Map(phaseRows.rows.map((p) => [p.key, p]))

  const blocks = Array.isArray(draft.blocks) ? draft.blocks : []
  const blockMeta = []

  for (const block of blocks) {
    const phaseKey = block.phase_key ?? block.phaseKey ?? (block.phase_id != null ? phaseById.get(String(block.phase_id))?.key : null)
    const phase = phaseKey ? phaseByKey.get(phaseKey) : (block.phase_id != null ? phaseById.get(String(block.phase_id)) : null)
    blockMeta.push({ block, phase, phaseKey: phase?.key ?? phaseKey })
  }

  const exerciseIds = [...new Set(
    blockMeta.flatMap((m) => (m.block.items ?? []).map((it) => Number(it.exercise_id ?? it.exerciseId)).filter(Number.isFinite)),
  )]

  const profileByExercisePhase = new Map()
  const regimenByExercise = new Map()
  let tagRows = []
  const methodologyKeysByExercise = new Map()

  if (exerciseIds.length > 0) {
    const [profiles, tags, regimens] = await Promise.all([
      pool.query(
        `SELECT p.*, sp.key AS phase_key FROM coaching.exercise_phase_profile p
         JOIN coaching.session_phase sp ON sp.id = p.phase_id WHERE p.exercise_id = ANY($1::bigint[])`,
        [exerciseIds],
      ),
      pool.query(
        `SELECT t.exercise_id, t.facet_type, t.facet_id, t.weight,
                COALESCE(ten.key, m.key, pe.key) AS facet_key
         FROM coaching.exercise_tag t
         LEFT JOIN coaching.tenet ten ON ten.id = t.facet_id AND t.facet_type = 'tenet'
         LEFT JOIN coaching.methodology m ON m.id = t.facet_id AND t.facet_type = 'methodology'
         LEFT JOIN coaching.physiological_emphasis pe ON pe.id = t.facet_id AND t.facet_type = 'physiology'
         WHERE t.exercise_id = ANY($1::bigint[])`,
        [exerciseIds],
      ),
      pool.query(`SELECT * FROM coaching.exercise_regimen_rule WHERE exercise_id = ANY($1::bigint[])`, [exerciseIds]),
    ])
    tagRows = tags.rows
    for (const p of profiles.rows) {
      profileByExercisePhase.set(`${p.exercise_id}:${p.phase_key}`, p)
    }
    for (const r of regimens.rows) {
      regimenByExercise.set(String(r.exercise_id), r)
    }
    for (const t of tags.rows) {
      if (t.facet_type !== 'methodology') continue
      const list = methodologyKeysByExercise.get(String(t.exercise_id)) ?? []
      if (t.facet_key) list.push(t.facet_key)
      methodologyKeysByExercise.set(String(t.exercise_id), list)
    }
  }

  const taxonomyKeys = {
    tenet: (await pool.query(`SELECT key FROM coaching.tenet`)).rows.map((r) => r.key),
    methodology: (await pool.query(`SELECT key FROM coaching.methodology`)).rows.map((r) => r.key),
    physiology: (await pool.query(`SELECT key FROM coaching.physiological_emphasis`)).rows.map((r) => r.key),
  }

  // Phase order
  let lastOrder = -1
  for (const meta of blockMeta) {
    if (!meta.phaseKey) continue
    const idx = phaseIndex(meta.phaseKey)
    if (idx < lastOrder) {
      const edu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'phase_order_violation' LIMIT 1`,
      )
      warnings.push({
        severity: 'warning',
        rule_key: 'phase_order_violation',
        message: `Phase ${meta.phase?.name ?? meta.phaseKey} appears out of recommended order.`,
        why: edu.rows[0]?.why_it_matters,
        recommendation: edu.rows[0]?.programming_guidance ?? 'Follow Prepare → Skill → Output → Capacity → Control → Fitness → Restore.',
        affected_items: [],
        related_phase: meta.phaseKey,
        can_override: true,
      })
    }
    lastOrder = Math.max(lastOrder, idx)
  }

  // Per-item rules
  for (let i = 0; i < blockMeta.length; i++) {
    const meta = blockMeta[i]
    const items = meta.block.items ?? []
    if (!meta.phaseKey || items.length === 0) continue

    const priorFatigue = computePriorFatigue(blockMeta, i, profileByExercisePhase, regimenByExercise)

    for (const item of items) {
      const exerciseId = Number(item.exercise_id ?? item.exerciseId)
      if (!exerciseId) continue

      const profiles = [...profileByExercisePhase.entries()]
        .filter(([k]) => k.startsWith(`${exerciseId}:`))
        .map(([, v]) => v)

      const phaseProfile = profileByExercisePhase.get(`${exerciseId}:${meta.phaseKey}`)
      const avoidProfile = profiles.find((p) => p.role === 'avoid' && p.phase_key === meta.phaseKey)

      if (avoidProfile) {
        errors.push({
          severity: 'error',
          rule_key: 'exercise_avoid_in_phase',
          message: `${item.exercise_name ?? 'Exercise'} should not be used in ${meta.phase?.name ?? meta.phaseKey}.`,
          why: avoidProfile.notes ?? 'This exercise is marked avoid for this phase.',
          recommendation: 'Remove or move to an allowed phase.',
          affected_items: [item.exercise_name ?? String(exerciseId)],
          related_phase: meta.phaseKey,
          can_override: false,
        })
      }

      const freshnessRequired = Boolean(
        phaseProfile?.freshness_required
        || (phaseProfile?.role === 'primary' && meta.phaseKey === 'output')
        || Number(phaseProfile?.fatigue_sensitivity) >= 4,
      )

      if (freshnessRequired && priorFatigue >= 3) {
        const [edu, exEdu] = await Promise.all([
          pool.query(`SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'freshness_required_after_fatigue' LIMIT 1`),
          pool.query(`SELECT * FROM coaching.education_content WHERE entity_type = 'exercise' AND entity_id = $1 LIMIT 1`, [exerciseId]),
        ])
        warnings.push({
          severity: 'warning',
          rule_key: 'freshness_required_after_fatigue',
          message: `${item.exercise_name ?? 'Exercise'} is placed after fatiguing work.`,
          why: exEdu.rows[0]?.fatigue_logic ?? edu.rows[0]?.why_it_matters,
          recommendation: edu.rows[0]?.programming_guidance ?? `Move ${item.exercise_name ?? 'exercise'} earlier, before Capacity or Fitness.`,
          affected_items: [item.exercise_name ?? String(exerciseId)],
          related_phase: meta.phaseKey,
          can_override: true,
          override_requires_reason: true,
        })
      }

      const methods = methodologyKeysByExercise.get(String(exerciseId)) ?? []
      if (meta.phaseKey === 'output' && methods.includes('hiit')) {
        warnings.push({
          severity: 'warning',
          rule_key: 'hiit_in_output_phase',
          message: `${item.exercise_name ?? 'Exercise'} is tagged HIIT but placed in Output.`,
          why: 'HIIT trains repeatability under fatigue, not maximal speed or power.',
          recommendation: 'Move to Fitness / Repeatability near the end of the session.',
          affected_items: [item.exercise_name ?? String(exerciseId)],
          related_phase: meta.phaseKey,
          can_override: true,
        })
      }
    }
  }

  // HIIT before skill/output (phase-level)
  const fitnessIdx = blockMeta.findIndex((m) => m.phaseKey === 'fitness_repeatability')
  const earlySensitive = blockMeta.findIndex((m) => ['skill_movement_intelligence', 'output'].includes(m.phaseKey))
  if (fitnessIdx >= 0 && earlySensitive >= 0 && fitnessIdx < earlySensitive) {
    const edu = await pool.query(
      `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'hiit_before_skill_output' LIMIT 1`,
    )
    warnings.push({
      severity: 'warning',
      rule_key: 'hiit_before_skill_output',
      message: 'Conditioning appears before Skill or Output phases.',
      why: edu.rows[0]?.why_it_matters,
      recommendation: edu.rows[0]?.programming_guidance,
      affected_items: [],
      can_override: true,
      override_requires_reason: true,
    })
  }

  // Plyo/output after fitness — methodology in earlier blocks
  if (fitnessIdx >= 0) {
    for (let i = fitnessIdx + 1; i < blockMeta.length; i++) {
      const meta = blockMeta[i]
      if (!['output', 'skill_movement_intelligence'].includes(meta.phaseKey)) continue
      for (const item of meta.block.items ?? []) {
        const exerciseId = Number(item.exercise_id ?? item.exerciseId)
        const methods = methodologyKeysByExercise.get(String(exerciseId)) ?? []
        if (methods.includes('plyometrics') || methods.includes('neural')) {
          recommendations.push({
            severity: 'recommendation',
            rule_key: 'plyo_after_conditioning',
            message: `${item.exercise_name ?? 'Exercise'} is a freshness-sensitive drill placed after conditioning.`,
            why: 'Plyometrics and max neural work require stiffness, intent, and clean mechanics that fatigue degrades.',
            recommendation: `Move ${item.exercise_name ?? 'exercise'} before the Fitness phase.`,
            affected_items: [item.exercise_name ?? String(exerciseId)],
            related_phase: meta.phaseKey,
            can_override: true,
          })
        }
      }
    }
  }

  // Duration overflow
  const budgetMinutes = draft.duration_minutes ?? draft.target_minutes ?? draft.durationMinutes ?? draft.targetMinutes
  const time = computeTimeSummary(blockMeta, budgetMinutes)
  if (time.budget_seconds > 0 && time.planned_seconds > time.budget_seconds * 1.1) {
    warnings.push({
      severity: 'warning',
      rule_key: 'duration_overflow',
      message: `Session is ~${time.planned_minutes} min planned vs ${time.budget_minutes} min budget.`,
      why: 'Over-filled sessions reduce quality and recovery between efforts.',
      recommendation: 'Reduce sets, remove an accessory, or extend the session budget.',
      can_override: true,
    })
  }

  const coverage = computeCoverage(blockMeta, tagRows, taxonomyKeys)
  const fatigue = computeFatigueSummary(blockMeta, profileByExercisePhase, regimenByExercise)

  const status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : recommendations.length > 0 ? 'warning' : 'valid'
  return { status, errors, warnings, recommendations, coverage, fatigue, time }
}

export { PHASE_ORDER, phaseIndex, itemSeconds, blockSeconds, computePriorFatigue, computeTimeSummary }
