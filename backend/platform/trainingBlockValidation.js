export async function validateTrainingBlockDraft(pool, draft) {
  const errors = []
  const warnings = []
  const recommendations = []

  const durationDays = Number(draft.duration_days ?? draft.durationDays) || 7
  const sessionsPerWeek = Number(draft.sessions_per_week ?? draft.sessionsPerWeek) || 3
  const sessions = Array.isArray(draft.sessions) ? draft.sessions : []
  const rule = draft.rule ?? {}

  if (!String(draft.name ?? '').trim()) {
    errors.push({ severity: 'error', rule_key: 'name_required', message: 'Block name is required.', can_override: false })
  }

  if (sessions.length === 0) {
    warnings.push({
      severity: 'warning',
      rule_key: 'no_sessions',
      message: 'Block has no session days defined.',
      recommendation: 'Add at least one session day with duration and objective.',
      can_override: true,
    })
  }

  if (sessions.length > sessionsPerWeek * Math.ceil(durationDays / 7)) {
    warnings.push({
      severity: 'warning',
      rule_key: 'session_count_high',
      message: `Session count (${sessions.length}) exceeds expected ${sessionsPerWeek}/wk over ${durationDays} days.`,
      can_override: true,
    })
  }

  const dayIndices = sessions.map((s) => Number(s.day_index ?? s.dayIndex)).filter(Number.isFinite)
  for (const day of dayIndices) {
    if (day < 1 || day > durationDays) {
      warnings.push({
        severity: 'warning',
        rule_key: 'day_out_of_range',
        message: `Session day ${day} is outside block duration (${durationDays} days).`,
        can_override: true,
      })
    }
  }

  const hardNeuralDays = sessions
    .filter((s) => Number(s.neural_load ?? s.neuralLoad) >= 4)
    .map((s) => Number(s.day_index ?? s.dayIndex))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)

  const minHoursNeural = Number(rule.minimum_hours_between_hard_neural ?? rule.minimumHoursBetweenHardNeural) || 48
  for (let i = 1; i < hardNeuralDays.length; i++) {
    const gapDays = hardNeuralDays[i] - hardNeuralDays[i - 1]
    if (gapDays < Math.ceil(minHoursNeural / 24)) {
      warnings.push({
        severity: 'warning',
        rule_key: 'neural_recovery_gap',
        message: `Hard neural sessions on days ${hardNeuralDays[i - 1]} and ${hardNeuralDays[i]} may not allow ${minHoursNeural}h recovery.`,
        recommendation: 'Space max-speed, plyometric, or advanced skill days further apart.',
        can_override: true,
        override_requires_reason: true,
      })
    }
  }

  const hiitSessions = sessions.filter((s) => Number(s.conditioning_load ?? s.conditioningLoad) >= 4).length
  const maxHiit = Number(rule.max_hiit_sessions_per_week ?? rule.maxHiitSessionsPerWeek) || 3
  if (hiitSessions > maxHiit) {
    warnings.push({
      severity: 'warning',
      rule_key: 'hiit_frequency',
      message: `${hiitSessions} high-conditioning sessions exceed weekly max (${maxHiit}).`,
      can_override: true,
    })
  }

  for (const session of sessions) {
    if (!session.session_objective && !session.sessionObjective && !session.session_name && !session.sessionName) {
      recommendations.push({
        severity: 'recommendation',
        rule_key: 'session_objective_missing',
        message: `Day ${session.day_index ?? session.dayIndex ?? '?'} has no session objective or name.`,
        recommendation: 'Add a session objective so coaches understand daily intent.',
        can_override: true,
      })
    }
    if (!Number(session.duration_minutes ?? session.durationMinutes)) {
      warnings.push({
        severity: 'warning',
        rule_key: 'session_duration_missing',
        message: `Day ${session.day_index ?? session.dayIndex ?? '?'} has no duration.`,
        can_override: true,
      })
    }
  }

  const status = errors.length ? 'error' : warnings.length ? 'warning' : recommendations.length ? 'warning' : 'valid'
  return { status, errors, warnings, recommendations }
}
