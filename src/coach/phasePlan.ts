import { SESSION_PHASE_ORDER } from './taxonomy'

export type SessionObjective =
  | 'general_athletic_development'
  | 'speed_priority'
  | 'explosiveness_power_priority'
  | 'strength_priority'
  | 'agility_priority'
  | 'skill_tumbling_priority'
  | 'mobility_control_priority'
  | 'fitness_priority'
  | 'recovery_low_intensity'

export interface PhasePlanRow {
  phaseKey: string
  minutes: number
  label?: string
  contains_tumbling?: boolean
  containsTumbling?: boolean
  add_on_focus?: string
  addOnFocus?: string
}

/** Normalize template JSON (`phase` vs `phaseKey`) from API seeds. */
export function normalizePhasePlanRow(raw: Record<string, unknown>): PhasePlanRow | null {
  const phaseKey = String(raw.phaseKey ?? raw.phase ?? '').trim()
  const minutes = Number(raw.minutes)
  if (!phaseKey || !Number.isFinite(minutes) || minutes < 0) return null
  return {
    phaseKey,
    minutes,
    label: raw.label != null ? String(raw.label) : undefined,
    contains_tumbling: Boolean(raw.contains_tumbling ?? raw.containsTumbling),
    add_on_focus: raw.add_on_focus != null ? String(raw.add_on_focus) : raw.addOnFocus != null ? String(raw.addOnFocus) : undefined,
  }
}

export function normalizePhasePlan(raw: unknown): PhasePlanRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map((row) => normalizePhasePlanRow(row as Record<string, unknown>)).filter(Boolean) as PhasePlanRow[]
}

const OBJECTIVE_TEMPLATES_60: Record<SessionObjective, PhasePlanRow[]> = {
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

function scalePlan(plan: PhasePlanRow[], targetMinutes: number, baseMinutes = 60): PhasePlanRow[] {
  if (targetMinutes === baseMinutes) return plan
  const ratio = targetMinutes / baseMinutes
  const scaled = plan.map((p) => ({ ...p, minutes: Math.max(p.minutes > 0 ? 1 : 0, Math.round(p.minutes * ratio)) }))
  const total = scaled.reduce((s, p) => s + p.minutes, 0)
  const delta = targetMinutes - total
  if (delta !== 0 && scaled.length > 0) {
    const idx = scaled.findIndex((p) => p.phaseKey === 'capacity') >= 0
      ? scaled.findIndex((p) => p.phaseKey === 'capacity')
      : scaled.length - 2
    scaled[idx] = { ...scaled[idx], minutes: Math.max(0, scaled[idx].minutes + delta) }
  }
  return scaled.filter((p) => p.minutes > 0)
}

export function phasePlanForObjective(objective: SessionObjective, durationMinutes: number): PhasePlanRow[] {
  const base = OBJECTIVE_TEMPLATES_60[objective] ?? OBJECTIVE_TEMPLATES_60.general_athletic_development
  return scalePlan(base, durationMinutes, 60)
}

/** Insert add-on minutes into an existing plan per Athleticism Accelerator rules. */
export function applyAddOnToPlan(plan: PhasePlanRow[], addOnFocus: string, addOnMinutes: number): PhasePlanRow[] {
  if (!addOnFocus || addOnMinutes <= 0) return plan
  const focus = addOnFocus.toLowerCase()
  const rows = [...plan]

  const insertAfterPhase = (phaseKey: string, row: PhasePlanRow) => {
    const idx = rows.findIndex((r) => r.phaseKey === phaseKey)
    const at = idx >= 0 ? idx + 1 : rows.length
    rows.splice(at, 0, row)
  }

  if (focus === 'speed' || focus === 'explosiveness' || focus === 'explosiveness_power' || focus === 'agility') {
    insertAfterPhase('movement_intelligence', {
      phaseKey: 'output',
      minutes: addOnMinutes,
      label: `${focus} add-on`,
      add_on_focus: focus,
    })
  } else if (focus === 'strength' || focus === 'calisthenics') {
    insertAfterPhase('output', {
      phaseKey: 'capacity',
      minutes: addOnMinutes,
      label: 'Strength add-on',
      add_on_focus: focus,
    })
  } else if (focus === 'fitness' || focus === 'fitness_conditioning' || focus === 'conditioning') {
    const fitnessIdx = rows.findIndex((r) => r.phaseKey === 'sustained_capacity')
    if (fitnessIdx >= 0) {
      rows[fitnessIdx] = {
        ...rows[fitnessIdx],
        minutes: rows[fitnessIdx].minutes + addOnMinutes,
        add_on_focus: focus,
        label: rows[fitnessIdx].label ?? 'Sustained Capacity add-on',
      }
    } else {
      insertAfterPhase('resilience', {
        phaseKey: 'sustained_capacity',
        minutes: addOnMinutes,
        label: 'Sustained Capacity add-on',
        add_on_focus: focus,
      })
    }
  } else if (focus === 'mobility' || focus === 'mobility_control') {
    rows[0] = { ...rows[0], minutes: rows[0].minutes + Math.floor(addOnMinutes / 2) }
    const restoreIdx = rows.findIndex((r) => r.phaseKey === 'restore')
    if (restoreIdx >= 0) {
      rows[restoreIdx] = { ...rows[restoreIdx], minutes: rows[restoreIdx].minutes + Math.ceil(addOnMinutes / 2) }
    }
  } else {
    insertAfterPhase('resilience', {
      phaseKey: 'resilience',
      minutes: addOnMinutes,
      label: `${focus} add-on`,
      add_on_focus: focus,
    })
  }

  return rows
}

export function sortPhasePlan(plan: PhasePlanRow[]): PhasePlanRow[] {
  return [...plan].sort((a, b) => {
    const ai = SESSION_PHASE_ORDER.indexOf(a.phaseKey as (typeof SESSION_PHASE_ORDER)[number])
    const bi = SESSION_PHASE_ORDER.indexOf(b.phaseKey as (typeof SESSION_PHASE_ORDER)[number])
    return (ai >= 0 ? ai : 99) - (bi >= 0 ? bi : 99)
  })
}

export const SESSION_OBJECTIVE_OPTIONS: Array<{ value: SessionObjective; label: string }> = [
  { value: 'general_athletic_development', label: 'General athletic development' },
  { value: 'speed_priority', label: 'Speed priority' },
  { value: 'explosiveness_power_priority', label: 'Explosiveness / power priority' },
  { value: 'strength_priority', label: 'Strength priority' },
  { value: 'agility_priority', label: 'Agility priority' },
  { value: 'skill_tumbling_priority', label: 'Skill / tumbling priority' },
  { value: 'mobility_control_priority', label: 'Mobility / control priority' },
  { value: 'fitness_priority', label: 'Sustained Capacity priority' },
  { value: 'recovery_low_intensity', label: 'Recovery / low intensity' },
]
