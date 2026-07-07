import { create } from 'zustand'
import { defaultPhaseRows, type NeedsEnginePhaseRow, type WorkMode } from './phaseArchitect'
import { SESSION_OBJECTIVE_OPTIONS, type SessionObjective } from './phasePlan'
import type { AudienceSplit, PrescriptionResult, ProgrammingMethod } from './types'

export interface NeedsEngineComboboxOption {
  id: string | number
  label: string
  meta?: string
}

export interface NeedsEnginePhaseRowState extends NeedsEnginePhaseRow {
  focusFacetType?: '' | 'tenet' | 'methodology' | 'physiology' | 'order_slot'
}

function defaultPhaseRowState(): NeedsEnginePhaseRowState[] {
  return (defaultPhaseRows(60) as NeedsEnginePhaseRow[]).map((r) => ({
    ...r,
    focusFacetType: r.focusTargets?.[0]?.facetType ?? '',
  }))
}

export function defaultNeedsEngineState() {
  return {
    workMode: 'exercise' as WorkMode,
    sessionObjective: 'general_athletic_development' as SessionObjective,
    sessionMinutes: 60,
    customMinutes: '' as number | '',
    sportId: '' as number | '',
    skillLevel: '',
    ageMin: '' as number | '',
    ageMax: '' as number | '',
    difficultyOverride: '' as number | '',
    audienceSplits: [] as AudienceSplit[],
    equipmentMode: 'use' as 'use' | 'avoid',
    equipmentUse: [] as NeedsEngineComboboxOption[],
    equipmentAvoid: [] as NeedsEngineComboboxOption[],
    avoidTokens: [] as NeedsEngineComboboxOption[],
    phaseRows: defaultPhaseRowState(),
    userEditedPrepare: false,
    architectAdjustments: [] as string[],
    selectedTemplateKey: '',
    result: null as PrescriptionResult | null,
    blockProgramming: [] as (ProgrammingMethod | null)[],
    nlPrompt: '',
  }
}

interface NeedsEngineStore extends ReturnType<typeof defaultNeedsEngineState> {
  patch: (patch: Partial<Omit<NeedsEngineStore, 'patch' | 'reset'>>) => void
  reset: () => void
}

export const useNeedsEngineStore = create<NeedsEngineStore>((set) => ({
  ...defaultNeedsEngineState(),
  patch: (patch) => set(patch),
  reset: () => set(defaultNeedsEngineState()),
}))

export { SESSION_OBJECTIVE_OPTIONS }
