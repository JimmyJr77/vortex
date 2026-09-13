import type { NormalizedCoachWorkoutRequest } from './workoutProgrammingRequest.js'
import type { WorkoutProgrammingSessionIntent } from './workoutProgrammingDirector.js'
import type { LibraryReadPool, WorkoutProgrammingMaterials } from './workoutProgrammingLibrarians.js'
import type { CanonicalProgrammingActivity } from './canonicalProgrammingDose.js'
import type { ProgrammingSessionSchedule, ProgrammingReserve } from './workoutResourceScheduler.js'
import type { ProgrammingPreparationDemand, ProgrammingPreparationProposal } from './workoutPreparation.js'
import type { SessionComponentKey, SessionComponentPlan } from './sessionComponentContract.js'
import type { ProgrammingStaffRegistry, ProgrammingStaffRunOptions, ProgrammingStaffRun, ProgrammingStaffTrace } from './programmingStaffRuntime.js'
import type { ProgrammingCriticResult } from './workoutProgrammingQA.js'
import type { ProgrammingLoadLedger } from './workoutLoadLedger.js'
import type { ProgrammingCandidateEligibilityReport } from './workoutProgrammingEligibility.js'

export const PROGRAMMING_BUILDER_VERSION: '1.0.0'
export interface ProgrammingCandidateGroup {
  readonly key: SessionComponentKey
  readonly candidates: readonly { readonly card: CanonicalProgrammingActivity['card']; readonly profile: CanonicalProgrammingActivity['profile']; readonly score: number; readonly methodIds: readonly string[] }[]
}
export function programmingCandidateMaterials(materials: WorkoutProgrammingMaterials): readonly ProgrammingCandidateGroup[]
export function builderCapabilityContract(request: NormalizedCoachWorkoutRequest, downstream: readonly ProgrammingCandidateGroup[]): {
  readonly outputSchema: object; readonly parseOutput: (raw: unknown) => ProgrammingBuilderProposal
}
export interface ProgrammingCompositionIssue {
  readonly code: string
  readonly componentKey?: SessionComponentKey
  readonly deliveryProfileId?: string
  readonly programmingMethodId?: string
  readonly activityId?: string
  readonly capabilityId?: string
  readonly detail?: string
  readonly equipmentKey?: string
  readonly facet?: string
  readonly value?: string
  readonly findings?: readonly Readonly<Record<string, unknown>>[]
}
export interface ProgrammingBuilderProposal {
  readonly requestRevision: string
  readonly summary: string
  readonly watchPoints: readonly string[]
  readonly components: readonly { readonly key: SessionComponentKey; readonly reserve: ProgrammingReserve;
    readonly selections: readonly { readonly deliveryProfileId: string; readonly programmingMethodId: string; readonly rationale: string; readonly sourceBlockId?: string | null }[] }[]
}
export interface ProgrammingBuilderRevision {
  readonly previousDraft: WorkoutProgrammingDraft
  readonly mutableComponentKeys: readonly Exclude<SessionComponentKey, 'prepare_and_access'>[]
  readonly feedback: ProgrammingCriticResult['findings']
}
export interface WorkoutProgrammingDraft {
  readonly schemaVersion: '1.0.0'
  readonly draftId: string
  readonly request: NormalizedCoachWorkoutRequest
  readonly requestHash: string
  readonly intentId: string
  readonly libraryRelease: { readonly id: string; readonly version: string; readonly ruleVersion: string }
  readonly componentPlan: SessionComponentPlan
  readonly builderSource: 'session_builder' | 'deterministic_review_draft'
  readonly builderProposal: ProgrammingBuilderProposal
  readonly preparationProposal: ProgrammingPreparationProposal | null
  readonly preparationDemand: ProgrammingPreparationDemand
  readonly activities: readonly (CanonicalProgrammingActivity & { readonly rationale: string; readonly sourceHash: string })[]
  readonly schedule: ProgrammingSessionSchedule
  readonly load: ProgrammingLoadLedger
  readonly coverage: { readonly status: 'PASS' | 'REVISE'; readonly issues: readonly ProgrammingCompositionIssue[] }
  readonly candidateEligibility: readonly ProgrammingCandidateEligibilityReport[]
  readonly issues: readonly ProgrammingCompositionIssue[]
  readonly repairs: readonly { readonly activityId: string; readonly code: 'reviewed_set_reduction'; readonly fromSets: number; readonly toSets: number; readonly reason?: string }[]
  readonly revisions: readonly { readonly role: 'session_builder'; readonly findings: readonly ProgrammingCompositionIssue[] }[]
  readonly status: 'NEEDS_COACH_REVIEW' | 'READY_FOR_CRITIC'
  readonly validatedWorkout: false
  readonly creatorAuthorized: false
  readonly trace: ProgrammingStaffTrace
  readonly compositionAttempts: number
}
export function validateProgrammingCoverage(request: NormalizedCoachWorkoutRequest, activities: readonly CanonicalProgrammingActivity[]): WorkoutProgrammingDraft['coverage']
export function scheduleProgrammingDraft(args: Pick<WorkoutProgrammingDraft, 'request' | 'componentPlan' | 'activities' | 'builderProposal' | 'preparationProposal'>): ProgrammingSessionSchedule
export function buildWorkoutProgrammingDraft(args: { readonly pool: LibraryReadPool; readonly context: { readonly facilityId: number | string; readonly userId: number | string };
  readonly sessionIntent: WorkoutProgrammingSessionIntent; readonly registry: ProgrammingStaffRegistry; readonly builderCapabilityId?: string;
  readonly prepareCapabilityId?: string; readonly runOptions?: ProgrammingStaffRunOptions; readonly staffRun?: ProgrammingStaffRun | null;
  readonly revision?: ProgrammingBuilderRevision | null }): Promise<WorkoutProgrammingDraft>
