export type SessionComponentKey =
  | 'prepare_and_access'
  | 'explosiveness'
  | 'strength'
  | 'capacity_competition'
  | 'body_control'

export const SESSION_COMPONENT_SCHEMA_VERSION: '1.0.0'
export const SESSION_COMPONENT_ORDER: readonly SessionComponentKey[]
export const SESSION_COMPONENT_LABELS: Readonly<Record<SessionComponentKey, string>>

export interface ComponentEquipmentPreferences {
  /** Omitted inherits global availability; [] permits no physical equipment. */
  readonly allowed?: readonly string[]
  readonly preferred?: readonly string[]
  readonly excluded?: readonly string[]
}

export interface EquipmentAvailability {
  readonly available: readonly string[]
  /** Unknown quantities must be resolved for required resources before scheduling. */
  readonly quantities?: Readonly<Record<string, number | null>>
  readonly excluded?: readonly string[]
}

export interface SessionComponentPlanInput {
  readonly schemaVersion?: '1.0.0'
  /** Total booked time, including tumbling if it appears in components. */
  readonly durationMinutes: number
  readonly equipment: EquipmentAvailability
  readonly components: readonly {
    readonly key: SessionComponentKey
    /** Includes execution, recovery, teaching, setup and transitions. */
    readonly budgetSeconds: number
    readonly equipment?: ComponentEquipmentPreferences
  }[]
}

export interface ResolvedComponentEquipment {
  readonly scope: 'inherit' | 'restricted'
  readonly allowed: readonly string[]
  readonly preferred: readonly string[]
  readonly excluded: readonly string[]
  readonly quantities: Readonly<Record<string, number | null>>
  readonly unknownQuantityKeys: readonly string[]
}

export interface SessionComponentPlan {
  readonly schemaVersion: '1.0.0'
  readonly durationMinutes: number
  readonly bookedSeconds: number
  readonly allocatedSeconds: number
  readonly reserveSeconds: number
  readonly equipment: {
    readonly available: readonly string[]
    readonly quantities: Readonly<Record<string, number | null>>
    readonly excluded: readonly string[]
  }
  readonly components: readonly {
    readonly key: SessionComponentKey
    readonly budgetSeconds: number
    readonly equipment: ResolvedComponentEquipment
  }[]
}

/** Throws TypeError/RangeError on invalid planning input. Does not validate a workout. */
export function normalizeSessionComponentPlan(raw: unknown): SessionComponentPlan
