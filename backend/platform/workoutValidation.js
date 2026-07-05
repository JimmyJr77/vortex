import { educationToWhyResponse } from './educationContent.js'

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

  // Phase order check
  let lastOrder = -1
  for (const meta of blockMeta) {
    if (!meta.phaseKey) continue
    const idx = phaseIndex(meta.phaseKey)
    if (idx < lastOrder) {
      const edu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'phase_order_violation' LIMIT 1`,
      )
      const why = educationToWhyResponse(edu.rows[0])
      warnings.push({
        severity: 'warning',
        rule_key: 'phase_order_violation',
        message: `Phase ${meta.phase?.name ?? meta.phaseKey} appears out of recommended order.`,
        why: why?.phase_rationale ?? edu.rows[0]?.why_it_matters,
        recommendation: 'Follow Prepare → Skill → Output → Capacity → Control → Fitness → Restore.',
        affected_items: [],
        related_phase: meta.phaseKey,
        can_override: true,
      })
    }
    lastOrder = Math.max(lastOrder, idx)
  }

  // Freshness / fatigue between blocks
  for (let i = 0; i < blockMeta.length; i++) {
    const meta = blockMeta[i]
    const items = meta.block.items ?? []
    if (!meta.phaseKey || items.length === 0) continue

    let priorFatigue = 0
    for (let j = 0; j < i; j++) {
      const priorItems = blockMeta[j].block.items ?? []
      for (const pi of priorItems) {
        priorFatigue = Math.max(priorFatigue, Number(pi.fatigue_cost) || 0)
      }
      const priorPhase = blockMeta[j].phaseKey
      if (priorPhase === 'fitness_repeatability') priorFatigue = Math.max(priorFatigue, 4)
    }

    for (const item of items) {
      const exerciseId = Number(item.exercise_id ?? item.exerciseId)
      if (!exerciseId) continue

      const profiles = await pool.query(
        `
          SELECT p.*, sp.key AS phase_key
          FROM coaching.exercise_phase_profile p
          JOIN coaching.session_phase sp ON sp.id = p.phase_id
          WHERE p.exercise_id = $1
        `,
        [exerciseId],
      )

      const phaseProfile = profiles.rows.find((p) => p.phase_key === meta.phaseKey)
      const avoidProfile = profiles.rows.find((p) => p.role === 'avoid' && p.phase_key === meta.phaseKey)

      if (avoidProfile) {
        errors.push({
          severity: 'error',
          rule_key: 'exercise_avoid_in_phase',
          message: `${item.exercise_name ?? 'Exercise'} should not be used in ${meta.phase?.name ?? meta.phaseKey}.`,
          why: avoidProfile.notes ?? 'This exercise is marked avoid for this phase.',
          recommendation: `Remove or move to an allowed phase.`,
          affected_items: [item.exercise_name ?? String(exerciseId)],
          related_phase: meta.phaseKey,
          can_override: false,
        })
      }

      const freshnessRequired = phaseProfile?.freshness_required || phaseProfile?.role === 'primary' && meta.phaseKey === 'output'
      if (freshnessRequired && priorFatigue >= 3) {
        const edu = await pool.query(
          `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'freshness_required_after_fatigue' LIMIT 1`,
        )
        const exEdu = await pool.query(
          `SELECT * FROM coaching.education_content WHERE entity_type = 'exercise' AND entity_id = $1 LIMIT 1`,
          [exerciseId],
        )
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
    }
  }

  // HIIT before skill/output
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
    })
  }

  const status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid'
  return {
    status,
    errors,
    warnings,
    recommendations,
    coverage: draft.coverage ?? {},
    fatigue: draft.fatigue ?? {},
    time: draft.time ?? {},
  }
}

export { PHASE_ORDER, phaseIndex }
