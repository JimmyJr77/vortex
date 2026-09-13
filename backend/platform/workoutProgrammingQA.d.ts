import type { WorkoutProgrammingDraft, ProgrammingBuilderProposal } from './workoutProgrammingBuilder.js'
import type { WorkoutProgrammingSessionIntent } from './workoutProgrammingDirector.js'
import type { ProgrammingStaffRegistry, ProgrammingStaffRunOptions, ProgrammingStaffRun, ProgrammingStaffTrace } from './programmingStaffRuntime.js'
import type { LibraryReadPool } from './workoutProgrammingLibrarians.js'
import type { SessionComponentKey } from './sessionComponentContract.js'
import type { ProgrammingMethodRuleResult } from './programmingMethodRules.js'
import type { ProgrammingAthleteEvidence } from './workoutAthleteEvidence.js'
import type { CanonicalProgrammingRuleResult } from './canonicalProgrammingRules.js'

export const PROGRAMMING_QA_VERSION: '1.0.0'
export type ProgrammingQAArea = 'impact_volume' | 'development_readiness' | 'redundancy' | 'sequencing' | 'cumulative_fatigue'
  | 'equipment_space' | 'timing_recovery' | 'complexity_supervision' | 'preparation' | 'objectives' | 'methodology' | 'coach_controls'
export type ProgrammingQARoute = 'director' | 'athlete_development' | 'programming_librarian' | 'exercise_librarian' | 'prepare_access' | 'session_builder' | 'coach'
export const PROGRAMMING_QA_AREAS: readonly ProgrammingQAArea[]
export const PROGRAMMING_QA_ROUTES: readonly ProgrammingQARoute[]
export interface ProgrammingQAFinding {
  readonly code: string
  readonly source: 'deterministic' | 'critic'
  readonly route: ProgrammingQARoute
  readonly message: string
  readonly activityIds: readonly string[]
  readonly componentKeys: readonly SessionComponentKey[]
  readonly area?: ProgrammingQAArea
  readonly recommendedAction?: string
  readonly evidence?: Readonly<Record<string, unknown>>
}
export interface ProgrammingDraftValidation {
  readonly schemaVersion: '1.0.0'
  readonly draftId: string
  readonly reviewHash: string
  readonly status: 'PASS' | 'REVISE'
  readonly findings: readonly ProgrammingQAFinding[]
  readonly reconstructed: {
    readonly qaVersion: '1.0.0'; readonly draftId: string; readonly intentId: string
    readonly request: WorkoutProgrammingDraft['request']; readonly componentPlan: WorkoutProgrammingDraft['componentPlan']
    readonly release: WorkoutProgrammingDraft['libraryRelease'] | null
    readonly director: WorkoutProgrammingSessionIntent['proposal']
    readonly athleteAdvice: WorkoutProgrammingSessionIntent['athleteAdvice']; readonly consultantAdvice: WorkoutProgrammingSessionIntent['consultantAdvice']
    readonly activities: WorkoutProgrammingDraft['activities']; readonly builderProposal: ProgrammingBuilderProposal | null
    readonly preparationProposal: WorkoutProgrammingDraft['preparationProposal']; readonly demand: WorkoutProgrammingDraft['preparationDemand']
    readonly schedule: WorkoutProgrammingDraft['schedule'] | null; readonly load: WorkoutProgrammingDraft['load']; readonly coverage: WorkoutProgrammingDraft['coverage']
    readonly methodRules: readonly ProgrammingMethodRuleResult[]
    readonly exerciseRules: readonly CanonicalProgrammingRuleResult[]
    readonly athleteEvidence: ProgrammingAthleteEvidence
  }
}
export interface ProgrammingCriticResult {
  readonly draftId: string
  readonly reviewHash: string
  readonly status: 'PASS' | 'REVISE'
  readonly summary: string
  readonly assessments: readonly { readonly area: ProgrammingQAArea; readonly status: 'PASS' | 'REVISE'; readonly summary: string }[]
  readonly findings: readonly { readonly area: ProgrammingQAArea; readonly route: ProgrammingQARoute; readonly message: string;
    readonly recommendedAction: string; readonly activityIds: readonly string[]; readonly componentKeys: readonly SessionComponentKey[] }[]
}
export interface WorkoutProgrammingQA {
  readonly schemaVersion: '1.0.0'; readonly qaId: string; readonly draftId: string; readonly reviewHash: string
  readonly status: 'QA_PASSED' | 'NEEDS_COACH_REVIEW'
  readonly validation: ProgrammingDraftValidation; readonly critic: ProgrammingCriticResult | null
  readonly finalValidation: ProgrammingDraftValidation | null
  readonly findings: readonly ProgrammingQAFinding[]; readonly revisionRoutes: readonly ProgrammingQARoute[]
  readonly trace: ProgrammingStaffTrace
  readonly validatedWorkout: false; readonly creatorAuthorized: false; readonly libraryApprovalGranted: false
}
export interface ProgrammingDraftReviewContext {
  readonly pool: LibraryReadPool; readonly context: { readonly facilityId: number | string; readonly userId: number | string }
  /** Server-owned state, not client-supplied authorization. */
  readonly sessionIntent: WorkoutProgrammingSessionIntent; readonly draft: WorkoutProgrammingDraft
}
export function validateWorkoutProgrammingDraft(args: ProgrammingDraftReviewContext & { readonly signal?: AbortSignal }): Promise<ProgrammingDraftValidation>
export function programmingCriticContract(validation: ProgrammingDraftValidation): { readonly outputSchema: object; readonly parseOutput: (raw: unknown) => ProgrammingCriticResult }
export function reviewWorkoutProgrammingDraft(args: ProgrammingDraftReviewContext & { readonly registry: ProgrammingStaffRegistry;
  readonly criticCapabilityId?: string; readonly runOptions?: ProgrammingStaffRunOptions; readonly staffRun?: ProgrammingStaffRun | null }): Promise<WorkoutProgrammingQA>
