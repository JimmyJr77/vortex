export {
  SESSION_PHASE_ORDER,
  PREPARE_PINNED_MINUTES,
  buildPhasePlan,
  redistributeOnDelete,
  defaultPhaseRows,
} from '../../backend/platform/phaseArchitect.js'

export type FocusFacetType = 'tenet' | 'methodology' | 'physiology' | 'order_slot'

export type OtherPhaseKind = 'skills' | 'games' | 'tramp_tumble'

export type WorkMode = 'exercise' | 'skill'

export interface PhaseFocusTarget {
  facetType: FocusFacetType
  facetId: number
  weight?: number
}

export interface NeedsEnginePhaseRow {
  phaseKey: string
  minutes: number
  label?: string
  pinned?: boolean
  contains_tumbling?: boolean
  focusTargets?: PhaseFocusTarget[]
  otherKind?: OtherPhaseKind
  otherItemIds?: number[]
  otherItemLabels?: string[]
}

export interface AudienceSplit {
  label: string
  ageMin: number
  ageMax: number
  difficultyOverride?: number | null
}

export interface PhaseArchitectInputs {
  workMode?: WorkMode
  sessionObjective?: string
  durationMinutes?: number
  ageMin?: number | null
  ageMax?: number | null
  userEditedPrepare?: boolean
  existingRows?: NeedsEnginePhaseRow[]
}

export interface PhaseArchitectResult {
  plan: NeedsEnginePhaseRow[]
  adjustments: string[]
}
