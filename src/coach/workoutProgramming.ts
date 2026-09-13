import type { CoachWorkoutRequest, ProgrammingPriorityFacet } from '../../backend/platform/workoutProgrammingRequest.js'
import type { SessionComponentKey } from '../../backend/platform/sessionComponentContract.js'
import type { SavedProgrammingWorkout, revalidateWorkoutProgrammingRun } from '../../backend/platform/workoutProgrammingRepository.js'

export type { CoachWorkoutRequest, ProgrammingAthleteCohort, ProgrammingComponentControls, ProgrammingPriority, ProgrammingEvidenceReference } from '../../backend/platform/workoutProgrammingRequest.js'
export type { WorkoutProgrammingChoices } from '../../backend/platform/workoutProgrammingChoices.js'
export type { ProgrammingEvidenceChoice } from '../../backend/platform/workoutAthleteEvidence.js'
export type { SavedProgrammingWorkout, ProgrammingWorkoutListItem, ProgrammingWorkoutCursor } from '../../backend/platform/workoutProgrammingRepository.js'
export type { SessionComponentKey } from '../../backend/platform/sessionComponentContract.js'
export type ProgrammingRevalidation = NonNullable<Awaited<ReturnType<typeof revalidateWorkoutProgrammingRun>>>
export type ProgrammingBlockEdit = NonNullable<NonNullable<CoachWorkoutRequest['modification']>['blockEdits']>[number]
export const COMPONENT_LABELS = {
  prepare_and_access: 'Prepare & Access', explosiveness: 'Explosiveness', strength: 'Strength',
  capacity_competition: 'Capacity / Competition', body_control: 'Body Control / Tumbling',
} satisfies Record<SessionComponentKey, string>
export const COMPONENT_KEYS = Object.keys(COMPONENT_LABELS) as SessionComponentKey[]
export const PRIORITY_FACETS = {
  tenet: 'Athletic quality', methodology: 'Methodology', training_family: 'Training family', athletic_niche: 'Athletic focus',
  force_velocity: 'Force / velocity', movement_character: 'Movement character', programming_set_structure: 'Set structure',
  programming_clock_structure: 'Clock structure', conditioning_protocol: 'Conditioning protocol', physiology_mechanism: 'Physiology',
} satisfies Record<ProgrammingPriorityFacet, string>

export function newProgrammingRequest(): CoachWorkoutRequest {
  return { requestId: crypto.randomUUID(), revision: crypto.randomUUID(), mode: 'guided', instruction: '', objective: 'general_athletic_development',
    athletes: [{ key: crypto.randomUUID(), athleteCount: 12, ageMin: 8, ageMax: 10, trainingExperience: 'beginner', memberIds: [], evidenceReferences: [] }],
    logistics: { athleticMinutes: 60, tumblingMinutes: 0, totalBookedMinutes: 60, coachCount: 1, laneCount: 3, stationCount: 3,
      sessionDate: null, sessionStartsAt: null, timerAvailable: null, scoreTrackingAvailable: null, clearRunoutConfirmed: null,
      space: { environment: 'indoor', floorAreaSquareFeet: null, laneLengthFeet: null } },
    equipment: { available: ['bodyweight'], quantities: {}, preferred: [], excluded: [], required: [] },
    priorities: [], components: COMPONENT_KEYS.map((key) => ({ key, selection: 'auto', budgetSeconds: null, priorities: [] })),
  }
}
export function requestFromSaved(saved: SavedProgrammingWorkout): CoachWorkoutRequest {
  const { assumptions: _assumptions, ...request } = saved.workout.intent
  void _assumptions // A new request must recompute server-owned conclusions from current sources.
  const equipmentKeys = (keys: readonly string[] | undefined) => keys?.map((key) => key === 'none' ? 'bodyweight' : key)
  return { ...structuredClone(request), requestId: crypto.randomUUID(), revision: crypto.randomUUID(),
    mode: request.mode === 'modify_existing' ? 'guided' : request.mode, modification: null,
    equipment: { ...request.equipment, available: equipmentKeys(request.equipment.available) ?? [],
      preferred: equipmentKeys(request.equipment.preferred), required: equipmentKeys(request.equipment.required), excluded: equipmentKeys(request.equipment.excluded) },
    components: COMPONENT_KEYS.map((key) => request.components.find((component) => component.key === key)
      ?? { key, selection: 'auto' as const, budgetSeconds: null, priorities: [], equipment: { allowed: undefined, preferred: [], excluded: [] } }).map((component) => ({ ...component, lockedBlocks: [], equipment: {
      allowed: equipmentKeys(component.equipment.allowed), preferred: equipmentKeys(component.equipment.preferred), excluded: equipmentKeys(component.equipment.excluded),
    } })) }
}
export function programmingRequestForSubmit(request: CoachWorkoutRequest): CoachWorkoutRequest {
  const active = activeProgrammingComponents(request)
  return { ...request, components: request.components?.filter((component) => component.key !== 'body_control' || (request.logistics.tumblingMinutes ?? 0) > 0),
    ...(request.modification ? { modification: { ...request.modification,
      regenerateComponentKeys: request.modification.regenerateComponentKeys?.filter((key) => active.includes(key)) ?? null,
    } } : {}),
    athletes: request.athletes.map((cohort) => ({ ...cohort,
    limitations: [...new Set((cohort.limitations ?? []).map((value) => value.trim()).filter(Boolean))],
  })) }
}
export function activeProgrammingComponents(request: CoachWorkoutRequest): SessionComponentKey[] {
  return COMPONENT_KEYS.filter((key) => (key !== 'body_control' || (request.logistics.tumblingMinutes ?? 0) > 0)
    && (key !== 'capacity_competition' || request.components?.find((component) => component.key === key)?.budgetSeconds !== 0))
}
export function revisionRequestFromSaved(saved: SavedProgrammingWorkout): CoachWorkoutRequest {
  const request = requestFromSaved(saved)
  return { ...request, mode: 'modify_existing', instruction: '', modification: {
    workoutId: saved.persistedWorkoutId, expectedRevision: saved.workout.revision,
    regenerateComponentKeys: activeProgrammingComponents(request), blockEdits: [],
  } }
}
export const durationLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
export function programmingError(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') return 'Programming canceled.'
  if (error instanceof Error) return error.message
  return 'The session could not be loaded. Try again.'
}
