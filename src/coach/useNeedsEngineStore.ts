import { create } from 'zustand'
import { defaultPhaseRows, type NeedsEnginePhaseRow, type WorkMode } from './phaseArchitect'
import { SESSION_OBJECTIVE_OPTIONS, type SessionObjective } from './phasePlan'
import type { AudienceSplit, PrescriptionResult, ProgrammingMethod, NeedsEngineRequirementsSnapshot } from './types'

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
    equipmentUsePolicy: 'must_use' as 'must_use' | 'use_only',
    allowBodyweight: true,
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

export function snapshotNeedsEngineState(
  state: Omit<NeedsEngineStore, 'patch' | 'reset'>,
): NeedsEngineRequirementsSnapshot {
  return {
    workMode: state.workMode,
    sessionObjective: state.sessionObjective,
    sessionMinutes: state.sessionMinutes,
    customMinutes: state.customMinutes,
    sportId: state.sportId,
    skillLevel: state.skillLevel,
    ageMin: state.ageMin,
    ageMax: state.ageMax,
    difficultyOverride: state.difficultyOverride,
    audienceSplits: state.audienceSplits,
    equipmentUsePolicy: state.equipmentUsePolicy,
    allowBodyweight: state.allowBodyweight,
    equipmentUse: state.equipmentUse,
    equipmentAvoid: state.equipmentAvoid,
    avoidTokens: state.avoidTokens,
    phaseRows: state.phaseRows.map(({ focusFacetType: _, ...row }) => row),
    userEditedPrepare: state.userEditedPrepare,
    result: state.result,
    blockProgramming: state.blockProgramming,
    nlPrompt: state.nlPrompt,
  }
}

export function applyNeedsEngineSnapshot(
  snapshot: NeedsEngineRequirementsSnapshot,
): Partial<Omit<NeedsEngineStore, 'patch' | 'reset'>> {
  return {
    workMode: snapshot.workMode,
    sessionObjective: snapshot.sessionObjective as SessionObjective,
    sessionMinutes: snapshot.sessionMinutes,
    customMinutes: snapshot.customMinutes,
    sportId: snapshot.sportId,
    skillLevel: snapshot.skillLevel,
    ageMin: snapshot.ageMin,
    ageMax: snapshot.ageMax,
    difficultyOverride: snapshot.difficultyOverride,
    audienceSplits: snapshot.audienceSplits,
    equipmentUsePolicy: snapshot.equipmentUsePolicy
      ?? (snapshot.equipmentMode === 'avoid' || snapshot.equipmentMode === 'use' ? 'must_use' : 'must_use'),
    allowBodyweight: snapshot.allowBodyweight !== false,
    equipmentUse: snapshot.equipmentUse,
    equipmentAvoid: snapshot.equipmentAvoid,
    avoidTokens: snapshot.avoidTokens,
    phaseRows: snapshot.phaseRows.map((r) => ({
      ...r,
      focusFacetType: r.focusTargets?.[0]?.facetType ?? '',
    })),
    userEditedPrepare: snapshot.userEditedPrepare,
    architectAdjustments: [],
    selectedTemplateKey: '',
    result: snapshot.result,
    blockProgramming: snapshot.blockProgramming ?? [],
    nlPrompt: snapshot.nlPrompt ?? '',
  }
}

export const useNeedsEngineStore = create<NeedsEngineStore>((set) => ({
  ...defaultNeedsEngineState(),
  patch: (patch) => set(patch),
  reset: () => set(defaultNeedsEngineState()),
}))

export { SESSION_OBJECTIVE_OPTIONS }
