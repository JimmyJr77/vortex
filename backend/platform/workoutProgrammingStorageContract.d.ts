import type { WorkoutProgrammingWorkflowResult } from './workoutProgrammingWorkflow.js'
import type { ProgrammingDraftValidation, ProgrammingQAFinding } from './workoutProgrammingQA.js'
export const PROGRAMMING_SESSION_MODEL: 'vortex_components_v1'
export const PROGRAMMING_STORAGE_VERSION: '1.0.0'
export const MAX_PROGRAMMING_SNAPSHOT_BYTES: number
export interface ProgrammingWorkoutEnvelope {
  readonly schemaVersion: '1.0.0'; readonly sessionModel: 'vortex_components_v1'; readonly generatorVersion: 'vortex-programming-staff/1.0.0'
  readonly ruleVersion: string; readonly modelVersion: string | null; readonly mode: 'ai_assisted'; readonly randomSeed: string
  readonly runId: string; readonly revision: string; readonly workflowHash: string; readonly contentHash: string
  readonly intent: WorkoutProgrammingWorkflowResult['draft']['request']; readonly status: 'QA_PASSED' | 'NEEDS_COACH_REVIEW'
  readonly validatedWorkout: boolean; readonly creatorAuthorized: false; readonly libraryApprovalGranted: false
  readonly validation: { readonly schemaVersion: '1.0.0'; readonly scope: 'saved_session_snapshot'; readonly status: 'PASS' | 'REVISE';
    readonly qaId: string; readonly reviewHash: string; readonly findings: readonly ProgrammingQAFinding[]; readonly freshValidation: ProgrammingDraftValidation }
  readonly explanation: { readonly session: string; readonly preparation: string | null; readonly activities: readonly {
    readonly activityId: string; readonly componentKey: WorkoutProgrammingWorkflowResult['draft']['activities'][number]['componentKey'];
    readonly exerciseCardId: string; readonly variantId: string; readonly deliveryProfileId: string; readonly programmingMethodId: string; readonly rationale: string
  }[] }
  readonly workflow: WorkoutProgrammingWorkflowResult
}
export function parseProgrammingWorkflowSnapshot(raw: unknown): WorkoutProgrammingWorkflowResult
export function createProgrammingWorkoutEnvelope(workflow: WorkoutProgrammingWorkflowResult, freshValidation: ProgrammingDraftValidation): ProgrammingWorkoutEnvelope
export function readProgrammingWorkoutEnvelope(raw: unknown): ProgrammingWorkoutEnvelope
