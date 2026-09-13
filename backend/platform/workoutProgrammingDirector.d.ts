import type { SessionComponentKey, SessionComponentPlan } from './sessionComponentContract.js'
import type { DeliveryPhaseKey, LibraryReadPool, ProgrammingResourceSearchResult, ProgrammingResourceSearch } from './workoutProgrammingLibrarians.js'
import type { NormalizedCoachWorkoutRequest } from './workoutProgrammingRequest.js'
import type { ProgrammingAthleteEvidence } from './workoutAthleteEvidence.js'
import type { ProgrammingStaffRegistry, ProgrammingStaffRunOptions, ProgrammingStaffRun, ProgrammingStaffTrace, ProgrammingSourceReference } from './programmingStaffRuntime.js'
import type { ProgrammingModificationContext } from './workoutProgrammingModification.js'

export const PROGRAMMING_DIRECTOR_VERSION: '1.0.0'
export const COMPONENT_DISCOVERY_PHASES: Readonly<Record<SessionComponentKey, readonly DeliveryPhaseKey[]>>
export interface ProgrammingDirectorProposal {
  readonly requestRevision: string
  readonly summary: string
  readonly components: readonly { readonly key: SessionComponentKey; readonly purpose: string; readonly rationale: string;
    readonly preferredExerciseProfileIds: readonly string[]; readonly preferredProgrammingMethodIds: readonly string[] }[]
  readonly watchPoints: readonly string[]
}
export function validateProgrammingDirectorProposal(request: NormalizedCoachWorkoutRequest, resources: readonly ProgrammingResourceSearchResult[], raw: unknown): ProgrammingDirectorProposal
export function programmingResourceRequests(request: NormalizedCoachWorkoutRequest, limit?: number): readonly ProgrammingResourceSearch[]
export interface AthleteDevelopmentAdvice {
  readonly observations: readonly { readonly cohortKey: string; readonly summary: string; readonly unknowns: readonly string[]; readonly recommendations: readonly string[] }[]
  readonly watchPoints: readonly string[]
}
export interface MethodologyConsultantAdvice {
  readonly summary: string
  readonly watchPoints: readonly string[]
  readonly recommendations: readonly { readonly componentKey: SessionComponentKey; readonly programmingMethodId: string;
    readonly rationale: string; readonly sourceReferenceIds: readonly string[] }[]
}
export interface WorkoutProgrammingSessionIntent {
  readonly scope: { readonly facilityId: string; readonly userId: string }
  readonly schemaVersion: '1.0.0'
  readonly intentId: string
  readonly request: NormalizedCoachWorkoutRequest
  readonly requestHash: string
  readonly componentPlan: SessionComponentPlan
  readonly resources: readonly ProgrammingResourceSearchResult[]
  readonly proposal: ProgrammingDirectorProposal
  readonly athleteAdvice: AthleteDevelopmentAdvice | null
  readonly athleteEvidence: ProgrammingAthleteEvidence
  readonly modification?: ProgrammingModificationContext
  readonly consultantAdvice: readonly { readonly capabilityId: string; readonly sourceReferences: readonly ProgrammingSourceReference[]; readonly advice: MethodologyConsultantAdvice }[]
  readonly decisionSource: 'deterministic_draft' | 'vortex_director'
  readonly status: 'NEEDS_COACH_REVIEW' | 'INTENT_READY'
  readonly issues: readonly { readonly code: string; readonly detail: string; readonly componentKey?: SessionComponentKey; readonly capabilityId?: string }[]
  readonly preparationStatus: 'DEFERRED_UNTIL_DOWNSTREAM_PRESCRIPTION'
  readonly omittedComponentKeys: readonly SessionComponentKey[]
  readonly validatedWorkout: false
  readonly creatorAuthorized: false
  readonly trace: ProgrammingStaffTrace
}
/** Read-only intent stage. Modify Existing reloads and verifies its immutable database parent. */
export function directWorkoutProgramming(args: {
  readonly pool: LibraryReadPool
  readonly context: { readonly facilityId: number | string; readonly userId: number | string }
  readonly rawRequest: unknown
  readonly registry: ProgrammingStaffRegistry
  readonly directorCapabilityId?: string
  readonly athleteCapabilityId?: string | null
  readonly runOptions?: ProgrammingStaffRunOptions
  readonly staffRun?: ProgrammingStaffRun | null
}): Promise<WorkoutProgrammingSessionIntent>
