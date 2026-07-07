export const SESSION_PHASE_ORDER: string[]

export const PREPARE_PINNED_MINUTES: Record<number, number>

export function buildPhasePlan(inputs: Record<string, unknown>): {
  plan: Array<{
    phaseKey: string
    minutes: number
    label?: string
    pinned?: boolean
    contains_tumbling?: boolean
    focusTargets?: unknown[]
    otherKind?: string
    otherItemIds?: number[]
  }>
  adjustments: string[]
}

export function redistributeOnDelete(
  plan: Array<{ phaseKey: string; minutes: number; pinned?: boolean }>,
  deletedPhaseKey: string,
  durationMinutes: number,
  pinnedPrepareMinutes: number,
): Array<{ phaseKey: string; minutes: number; pinned?: boolean }>

export function defaultPhaseRows(
  durationMinutes?: number,
  sessionObjective?: string,
): Array<{ phaseKey: string; minutes: number; label?: string; pinned?: boolean }>
