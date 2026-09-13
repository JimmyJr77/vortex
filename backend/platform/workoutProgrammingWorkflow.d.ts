import type { WorkoutProgrammingSessionIntent } from './workoutProgrammingDirector.js'
import type { WorkoutProgrammingDraft, ProgrammingBuilderRevision } from './workoutProgrammingBuilder.js'
import type { WorkoutProgrammingQA, ProgrammingQAFinding } from './workoutProgrammingQA.js'
import type { LibraryReadPool } from './workoutProgrammingLibrarians.js'
import type { ProgrammingStaffRegistry, ProgrammingStaffRunOptions, ProgrammingStaffTrace } from './programmingStaffRuntime.js'
import type { SessionComponentKey } from './sessionComponentContract.js'

export const PROGRAMMING_WORKFLOW_VERSION: '1.0.0'
export type ProgrammingRepairPlan = {
  readonly status: 'AUTOMATIC'; readonly sourceQaId: string; readonly reviewHash: string
  readonly scope: 'downstream' | 'prepare_access'
  readonly mutableComponentKeys: ProgrammingBuilderRevision['mutableComponentKeys']
  readonly requiredRoles: readonly ('session_builder' | 'prepare_access' | 'programming_critic')[]
  readonly feedback: ProgrammingBuilderRevision['feedback']
} | { readonly status: 'REQUIRES_COACH'; readonly sourceQaId: string; readonly reason: string }
export type ProgrammingWorkflowStopReason = 'qa_passed' | 'repair_limit_reached' | 'run_budget_exhausted' | 'no_automatic_repair_route'
  | 'repair_did_not_change_session' | 'repair_cycle_detected' | 'repair_failed_validation' | 'repair_failed'
export interface ProgrammingActivityAuditReference {
  readonly exerciseCardId: string; readonly variantId: string; readonly deliveryProfileId: string; readonly cardVersion: number
  readonly programmingMethodId: string; readonly sourceHash: string; readonly doseHash: string
}
export interface ProgrammingWorkflowHistoryEntry {
  readonly pass: number; readonly status: 'reviewed' | 'rejected' | 'failed'
  readonly sourceDraftId?: string; readonly sourceQaId?: string; readonly draftId?: string; readonly qaId?: string
  readonly qaStatus?: WorkoutProgrammingQA['status']; readonly contentHash?: string
  readonly callStart: number; readonly callEnd: number; readonly findings: readonly ProgrammingQAFinding[]
  readonly plan?: ProgrammingRepairPlan; readonly errorCode?: string; readonly reason?: ProgrammingWorkflowStopReason
  readonly preparationDemandChanged?: boolean
  readonly changes?: readonly { readonly componentKey: SessionComponentKey; readonly changed: boolean;
    readonly before: readonly ProgrammingActivityAuditReference[]; readonly after: readonly ProgrammingActivityAuditReference[] }[]
}
export interface WorkoutProgrammingWorkflowResult {
  readonly schemaVersion: '1.0.0'; readonly runId: string
  readonly sessionIntent: WorkoutProgrammingSessionIntent; readonly draft: WorkoutProgrammingDraft; readonly qa: WorkoutProgrammingQA
  readonly status: 'QA_PASSED' | 'NEEDS_COACH_REVIEW'; readonly stopReason: ProgrammingWorkflowStopReason
  readonly repairPasses: number; readonly maxRepairPasses: number; readonly compositionAttempts: number
  readonly history: readonly ProgrammingWorkflowHistoryEntry[]
  readonly workflowIssues: readonly { readonly code: string; readonly message: string; readonly attemptedDraftId?: string }[]
  readonly trace: ProgrammingStaffTrace
  readonly validatedWorkout: false; readonly creatorAuthorized: false; readonly libraryApprovalGranted: false
}
export function programmingDraftContentHash(draft: WorkoutProgrammingDraft): string
export function planProgrammingRepair(qa: WorkoutProgrammingQA): ProgrammingRepairPlan
export function generateWorkoutProgramming(args: {
  readonly pool: LibraryReadPool; readonly context: { readonly facilityId: string | number; readonly userId: string | number }
  readonly registry: ProgrammingStaffRegistry; readonly maxRepairPasses?: number; readonly runOptions?: ProgrammingStaffRunOptions
  readonly directorCapabilityId?: string; readonly athleteCapabilityId?: string | null
  readonly builderCapabilityId?: string; readonly prepareCapabilityId?: string; readonly criticCapabilityId?: string
} & ({ readonly rawRequest: unknown; readonly sessionIntent?: never } | { readonly sessionIntent: WorkoutProgrammingSessionIntent; readonly rawRequest?: never })): Promise<WorkoutProgrammingWorkflowResult>
