const PHASE_ORDER = [
  'prepare_and_access',
  'movement_intelligence',
  'output',
  'capacity',
  'resilience',
  'sustained_capacity',
  'restore',
]

export async function validateRegimenDraft(pool, draft) {
  const errors = []
  const warnings = []
  const recommendations = []

  const durationType = String(draft.duration_type ?? draft.durationType ?? '60')
  const sessionMinutes = Number(durationType) || 60
  const weeks = Number(draft.weeks) || 4
  const sessionsPerWeek = Number(draft.sessions_per_week ?? draft.sessionsPerWeek) || 3
  const distributions = Array.isArray(draft.phase_distributions ?? draft.phaseDistributions)
    ? (draft.phase_distributions ?? draft.phaseDistributions)
    : []

  if (!String(draft.name ?? '').trim()) {
    errors.push({ severity: 'error', rule_key: 'name_required', message: 'Regimen name is required.', can_override: false })
  }

  const totalPhaseMinutes = distributions.reduce((sum, d) => sum + (Number(d.default_minutes ?? d.defaultMinutes) || 0), 0)
  if (distributions.length > 0 && totalPhaseMinutes > 0 && Math.abs(totalPhaseMinutes - sessionMinutes) > sessionMinutes * 0.15) {
    warnings.push({
      severity: 'warning',
      rule_key: 'phase_minutes_mismatch',
      message: `Phase minutes (${totalPhaseMinutes}) do not match ${sessionMinutes} min session template.`,
      recommendation: 'Adjust phase distribution so weekly phase minutes align with session duration.',
      can_override: true,
    })
  }

  if (distributions.length === 0) {
    recommendations.push({
      severity: 'recommendation',
      rule_key: 'no_phase_distribution',
      message: 'No phase distribution defined.',
      recommendation: 'Set default minutes per phase so sessions stay balanced across the Athleticism Accelerator model.',
      can_override: true,
    })
  }

  const phaseRows = pool
    ? await pool.query(`SELECT id, key, name FROM coaching.session_phase`)
    : { rows: [] }
  const phaseById = new Map(phaseRows.rows.map((p) => [String(p.id), p]))

  const coveredKeys = new Set(
    distributions
      .map((d) => d.phase_key ?? d.phaseKey ?? phaseById.get(String(d.phase_id ?? d.phaseId))?.key)
      .filter(Boolean),
  )

  for (const key of ['prepare_and_access', 'restore']) {
    if (distributions.length > 0 && !coveredKeys.has(key)) {
      recommendations.push({
        severity: 'recommendation',
        rule_key: 'missing_access_restore',
        message: `Regimen has no ${key.replace('_', ' ')} phase minutes.`,
        recommendation: 'Include Prepare/Access and Restore in evergreen regimens.',
        can_override: true,
      })
    }
  }

  const outputMinutes = distributions
    .filter((d) => (d.phase_key ?? d.phaseKey ?? phaseById.get(String(d.phase_id ?? d.phaseId))?.key) === 'output')
    .reduce((sum, d) => sum + (Number(d.default_minutes ?? d.defaultMinutes) || 0), 0)
  const fitnessMinutes = distributions
    .filter((d) => (d.phase_key ?? d.phaseKey ?? phaseById.get(String(d.phase_id ?? d.phaseId))?.key) === 'sustained_capacity')
    .reduce((sum, d) => sum + (Number(d.default_minutes ?? d.defaultMinutes) || 0), 0)

  if (fitnessMinutes > outputMinutes * 1.5 && outputMinutes > 0) {
    warnings.push({
      severity: 'warning',
      rule_key: 'fitness_heavy_regimen',
      message: 'Fitness minutes exceed Output minutes substantially.',
      recommendation: 'Evergreen regimens should still protect speed/power quality unless fitness is the primary goal.',
      can_override: true,
    })
  }

  const expectedSessions = weeks * sessionsPerWeek
  const sessionTemplates = Array.isArray(draft.session_templates ?? draft.sessionTemplates)
    ? (draft.session_templates ?? draft.sessionTemplates)
    : []
  if (sessionTemplates.length > 0 && sessionTemplates.length < expectedSessions * 0.5) {
    recommendations.push({
      severity: 'recommendation',
      rule_key: 'sparse_session_templates',
      message: `Only ${sessionTemplates.length} session templates for ${expectedSessions} expected sessions.`,
      can_override: true,
    })
  }

  const status = errors.length ? 'error' : warnings.length ? 'warning' : recommendations.length ? 'warning' : 'valid'
  return { status, errors, warnings, recommendations, meta: { sessionMinutes, weeks, sessionsPerWeek, phaseOrder: PHASE_ORDER } }
}
