/**
 * Phase Architect — deterministic phase minute allocation for Needs Engine v2.
 * Product rules: pinned Prepare & Access, objective templates, input-driven exceptions.
 */

export const SESSION_PHASE_ORDER = [
  'prepare_and_access',
  'movement_intelligence',
  'output',
  'capacity',
  'resilience',
  'sustained_capacity',
  'restore',
]

export const PREPARE_PINNED_MINUTES = { 60: 7, 90: 10, 120: 10 }

const OBJECTIVE_TEMPLATES_60 = {
  general_athletic_development: [
    { phaseKey: 'prepare_and_access', minutes: 8 },
    { phaseKey: 'movement_intelligence', minutes: 8 },
    { phaseKey: 'output', minutes: 15 },
    { phaseKey: 'capacity', minutes: 18 },
    { phaseKey: 'resilience', minutes: 7 },
    { phaseKey: 'sustained_capacity', minutes: 3 },
    { phaseKey: 'restore', minutes: 1 },
  ],
  speed_priority: [
    { phaseKey: 'prepare_and_access', minutes: 8 },
    { phaseKey: 'movement_intelligence', minutes: 6 },
    { phaseKey: 'output', minutes: 22 },
    { phaseKey: 'capacity', minutes: 14 },
    { phaseKey: 'resilience', minutes: 6 },
    { phaseKey: 'sustained_capacity', minutes: 2 },
    { phaseKey: 'restore', minutes: 2 },
  ],
  explosiveness_power_priority: [
    { phaseKey: 'prepare_and_access', minutes: 8 },
    { phaseKey: 'movement_intelligence', minutes: 6 },
    { phaseKey: 'output', minutes: 20 },
    { phaseKey: 'capacity', minutes: 16 },
    { phaseKey: 'resilience', minutes: 7 },
    { phaseKey: 'sustained_capacity', minutes: 2 },
    { phaseKey: 'restore', minutes: 1 },
  ],
  strength_priority: [
    { phaseKey: 'prepare_and_access', minutes: 8 },
    { phaseKey: 'movement_intelligence', minutes: 5 },
    { phaseKey: 'output', minutes: 8 },
    { phaseKey: 'capacity', minutes: 28 },
    { phaseKey: 'resilience', minutes: 8 },
    { phaseKey: 'sustained_capacity', minutes: 2 },
    { phaseKey: 'restore', minutes: 1 },
  ],
  agility_priority: [
    { phaseKey: 'prepare_and_access', minutes: 8 },
    { phaseKey: 'movement_intelligence', minutes: 10 },
    { phaseKey: 'output', minutes: 18 },
    { phaseKey: 'capacity', minutes: 14 },
    { phaseKey: 'resilience', minutes: 7 },
    { phaseKey: 'sustained_capacity', minutes: 2 },
    { phaseKey: 'restore', minutes: 1 },
  ],
  skill_tumbling_priority: [
    { phaseKey: 'prepare_and_access', minutes: 8 },
    { phaseKey: 'movement_intelligence', minutes: 22, contains_tumbling: true },
    { phaseKey: 'output', minutes: 10 },
    { phaseKey: 'capacity', minutes: 12 },
    { phaseKey: 'resilience', minutes: 6 },
    { phaseKey: 'restore', minutes: 2 },
  ],
  mobility_control_priority: [
    { phaseKey: 'prepare_and_access', minutes: 12 },
    { phaseKey: 'movement_intelligence', minutes: 8 },
    { phaseKey: 'output', minutes: 8 },
    { phaseKey: 'capacity', minutes: 12 },
    { phaseKey: 'resilience', minutes: 16 },
    { phaseKey: 'sustained_capacity', minutes: 2 },
    { phaseKey: 'restore', minutes: 2 },
  ],
  fitness_priority: [
    { phaseKey: 'prepare_and_access', minutes: 8 },
    { phaseKey: 'movement_intelligence', minutes: 6 },
    { phaseKey: 'output', minutes: 10 },
    { phaseKey: 'capacity', minutes: 14 },
    { phaseKey: 'resilience', minutes: 6 },
    { phaseKey: 'sustained_capacity', minutes: 14 },
    { phaseKey: 'restore', minutes: 2 },
  ],
  recovery_low_intensity: [
    { phaseKey: 'prepare_and_access', minutes: 12 },
    { phaseKey: 'movement_intelligence', minutes: 10 },
    { phaseKey: 'output', minutes: 5 },
    { phaseKey: 'capacity', minutes: 10 },
    { phaseKey: 'resilience', minutes: 12 },
    { phaseKey: 'sustained_capacity', minutes: 0 },
    { phaseKey: 'restore', minutes: 11 },
  ],
}

function nearestDurationKey(minutes) {
  const m = Number(minutes) || 60
  if (m <= 75) return 60
  if (m <= 105) return 90
  return 120
}

function scaleRemainingPhases(plan, targetMinutes, pinnedPrepareMinutes) {
  const prepareRow = plan.find((p) => p.phaseKey === 'prepare_and_access')
  const prepareMinutes = pinnedPrepareMinutes ?? prepareRow?.minutes ?? 0
  const others = plan.filter((p) => p.phaseKey !== 'prepare_and_access')
  const othersBase = others.reduce((s, p) => s + p.minutes, 0)
  const remainingBudget = Math.max(0, targetMinutes - prepareMinutes)
  if (othersBase <= 0) return plan

  const scaled = others.map((p) => ({
    ...p,
    minutes: othersBase > 0 ? Math.max(p.minutes > 0 ? 1 : 0, Math.round((p.minutes / othersBase) * remainingBudget)) : 0,
  }))

  let total = prepareMinutes + scaled.reduce((s, p) => s + p.minutes, 0)
  let delta = targetMinutes - total
  if (delta !== 0 && scaled.length > 0) {
    const sorted = [...scaled].sort((a, b) => b.minutes - a.minutes)
    const key = sorted[0].phaseKey
    const idx = scaled.findIndex((p) => p.phaseKey === key)
    scaled[idx] = { ...scaled[idx], minutes: Math.max(0, scaled[idx].minutes + delta) }
    total = prepareMinutes + scaled.reduce((s, p) => s + p.minutes, 0)
    delta = targetMinutes - total
    if (delta !== 0 && scaled.length > 1) {
      const idx2 = scaled.findIndex((p) => p.phaseKey === sorted[1].phaseKey)
      scaled[idx2] = { ...scaled[idx2], minutes: Math.max(0, scaled[idx2].minutes + delta) }
    }
  }

  const result = []
  if (prepareRow) {
    result.push({ ...prepareRow, minutes: prepareMinutes, pinned: true })
  }
  for (const key of SESSION_PHASE_ORDER) {
    if (key === 'prepare_and_access') continue
    const row = scaled.find((p) => p.phaseKey === key)
    if (row && row.minutes > 0) result.push(row)
  }
  return result
}

function objectiveBasePlan(objective, durationMinutes) {
  const base = OBJECTIVE_TEMPLATES_60[objective] ?? OBJECTIVE_TEMPLATES_60.general_athletic_development
  const durKey = nearestDurationKey(durationMinutes)
  const ratio = durationMinutes / 60
  const scaled = base.map((p) => ({ ...p, minutes: Math.max(p.minutes > 0 ? 1 : 0, Math.round(p.minutes * ratio)) }))
  const pinned = PREPARE_PINNED_MINUTES[durKey] ?? PREPARE_PINNED_MINUTES[60]
  return scaleRemainingPhases(scaled, durationMinutes, pinned)
}

function shiftMinutes(plan, fromKey, toKey, amount) {
  if (amount <= 0) return plan
  const fromIdx = plan.findIndex((p) => p.phaseKey === fromKey)
  const toIdx = plan.findIndex((p) => p.phaseKey === toKey)
  if (fromIdx < 0 || toIdx < 0) return plan
  const take = Math.min(amount, Math.max(0, plan[fromIdx].minutes - (plan[fromIdx].pinned ? plan[fromIdx].minutes : 1)))
  if (take <= 0) return plan
  const next = plan.map((p) => ({ ...p }))
  next[fromIdx] = { ...next[fromIdx], minutes: next[fromIdx].minutes - take }
  next[toIdx] = { ...next[toIdx], minutes: next[toIdx].minutes + take }
  return next.filter((p) => p.minutes > 0 || p.pinned)
}

/**
 * @param {object} inputs
 * @returns {{ plan: object[], adjustments: string[] }}
 */
export function buildPhasePlan(inputs = {}) {
  const adjustments = []
  const durationMinutes = Number(inputs.durationMinutes) || 60
  const objective = inputs.sessionObjective || 'general_athletic_development'
  const workMode = inputs.workMode || 'exercise'
  const ageMin = inputs.ageMin != null ? Number(inputs.ageMin) : null
  const ageMax = inputs.ageMax != null ? Number(inputs.ageMax) : null
  const userEditedPrepare = Boolean(inputs.userEditedPrepare)
  const existingRows = Array.isArray(inputs.existingRows) ? inputs.existingRows : []

  const focusByPhase = new Map()
  for (const row of existingRows) {
    if (row.focusTargets?.length) focusByPhase.set(row.phaseKey, row.focusTargets)
    if (row.otherKind) focusByPhase.set(row.phaseKey, { otherKind: row.otherKind, otherItemIds: row.otherItemIds })
  }

  let plan = objectiveBasePlan(objective, durationMinutes)

  if (workMode === 'skill') {
    plan = shiftMinutes(plan, 'capacity', 'movement_intelligence', 6)
    adjustments.push('Skill mode: +6 min Movement Intelligence from Capacity')
  }

  const ageMid = ageMin != null && ageMax != null ? (ageMin + ageMax) / 2 : (ageMin ?? ageMax)
  if (ageMid != null && ageMid <= 8) {
    plan = shiftMinutes(plan, 'output', 'prepare_and_access', 2)
    adjustments.push('Young athletes (≤8): +2 min Prepare from Output')
  }

  if (userEditedPrepare) {
    const edited = existingRows.find((r) => r.phaseKey === 'prepare_and_access')
    if (edited?.minutes != null) {
      const durKey = nearestDurationKey(durationMinutes)
      const defaultPinned = PREPARE_PINNED_MINUTES[durKey] ?? 7
      plan = scaleRemainingPhases(plan, durationMinutes, Number(edited.minutes) || defaultPinned)
      adjustments.push(`Prepare & Access kept at coach-set ${edited.minutes} min`)
    }
  }

  const durKey = nearestDurationKey(durationMinutes)
  const pinnedPrepare = userEditedPrepare
    ? (existingRows.find((r) => r.phaseKey === 'prepare_and_access')?.minutes ?? PREPARE_PINNED_MINUTES[durKey])
    : PREPARE_PINNED_MINUTES[durKey]

  plan = scaleRemainingPhases(plan, durationMinutes, pinnedPrepare)

  const fullPlan = SESSION_PHASE_ORDER.map((phaseKey) => {
    const built = plan.find((p) => p.phaseKey === phaseKey)
    const existing = existingRows.find((r) => r.phaseKey === phaseKey)
    const minutes = built?.minutes ?? existing?.minutes ?? 0
    if (minutes <= 0 && phaseKey !== 'prepare_and_access' && !existing?.otherKind) {
      return null
    }
    return {
      phaseKey,
      minutes: phaseKey === 'prepare_and_access' ? (built?.minutes ?? pinnedPrepare) : minutes,
      label: existing?.label,
      pinned: phaseKey === 'prepare_and_access',
      contains_tumbling: built?.contains_tumbling ?? existing?.contains_tumbling,
      focusTargets: existing?.focusTargets ?? [],
      otherKind: existing?.otherKind,
      otherItemIds: existing?.otherItemIds ?? [],
    }
  }).filter(Boolean)

  return { plan: fullPlan, adjustments }
}

/**
 * Redistribute minutes when a phase is removed. Prepare stays pinned if present.
 */
export function redistributeOnDelete(plan, deletedPhaseKey, durationMinutes, pinnedPrepareMinutes) {
  const rows = plan.filter((p) => p.phaseKey !== deletedPhaseKey && p.minutes > 0)
  const freed = plan.find((p) => p.phaseKey === deletedPhaseKey)?.minutes ?? 0
  if (freed <= 0) return rows

  const recipients = rows.filter((p) => p.phaseKey !== 'prepare_and_access' || !p.pinned)
  const pool = recipients.filter((p) => p.phaseKey !== 'prepare_and_access' || !p.pinned)
  const totalWeight = pool.reduce((s, p) => s + p.minutes, 0) || pool.length

  const next = rows.map((p) => {
    if (p.phaseKey === 'prepare_and_access' && p.pinned) return p
    const share = totalWeight > 0 ? Math.round((p.minutes / totalWeight) * freed) : Math.round(freed / pool.length)
    return { ...p, minutes: p.minutes + share }
  })

  const total = next.reduce((s, p) => s + p.minutes, 0)
  const delta = durationMinutes - total
  if (delta !== 0) {
    const cap = next.find((p) => p.phaseKey === 'capacity') ?? next[next.length - 1]
    if (cap) {
      const idx = next.findIndex((p) => p.phaseKey === cap.phaseKey)
      next[idx] = { ...next[idx], minutes: Math.max(0, next[idx].minutes + delta) }
    }
  }

  return next
}

export function defaultPhaseRows(durationMinutes = 60, sessionObjective = 'general_athletic_development') {
  return buildPhasePlan({ durationMinutes, sessionObjective }).plan
}
