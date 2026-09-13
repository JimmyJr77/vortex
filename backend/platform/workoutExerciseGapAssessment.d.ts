import type { WorkoutExerciseGapResearch, WorkoutExerciseGapResearchInput } from './workoutExerciseGapResearch.js'
import type { LibraryReadPool } from './workoutProgrammingLibrarians.js'
import type { ProgrammingStaffRegistry, ProgrammingStaffRunOptions, ProgrammingStaffTrace, ProgrammingStaffRun } from './programmingStaffRuntime.js'
export interface ExerciseGapAlternative {
  readonly definitionId: string; readonly cardVersion: number
  readonly disposition: 'different_movement' | 'reusable' | 'missing_delivery_profile' | 'existing_content_needs_review' | 'context_conflict' | 'insufficient_evidence'
  readonly rationale: string
}
export interface ExerciseGapJudgment {
  readonly requestRevision: string; readonly researchHash: string; readonly summary: string
  readonly needAssessment: 'supported' | 'needs_coach_review'; readonly needRationale: string; readonly questions: readonly string[]
  readonly alternatives: readonly ExerciseGapAlternative[]; readonly proposedKind: 'none' | 'missing_movement' | 'missing_delivery_profile'
  readonly targetDefinitionId: string | null; readonly targetVariantId: string | null; readonly phaseKey: string | null; readonly programmingMethodId: string | null
}
export interface ExerciseGap {
  readonly id: string; readonly schemaVersion: '1.0.0'; readonly scope: WorkoutExerciseGapResearch['scope']; readonly requestRevision: string
  readonly requestHash: string; readonly researchHash: string; readonly sourceHash: string; readonly libraryRelease: NonNullable<WorkoutExerciseGapResearch['sources']['release']>
  readonly componentKey: WorkoutExerciseGapResearch['componentKey']; readonly unmetDemand: WorkoutExerciseGapResearch['need']
  readonly reason: 'missing_movement' | 'missing_delivery_profile'
  readonly target: { readonly exerciseCardId: string; readonly cardVersion: number; readonly variantId: string } | null
  readonly phaseKey: string; readonly programmingMethodId: string; readonly alternativesConsidered: readonly ExerciseGapAlternative[]
  readonly needRationale: string; readonly summary: string; readonly contentHash: string
  readonly humanReviewRequired: true; readonly authorizesLibraryInclusion: false
}
export interface WorkoutExerciseGapAssessment {
  readonly schemaVersion: '1.0.0'; readonly research: WorkoutExerciseGapResearch; readonly judgment: ExerciseGapJudgment | null
  readonly status: 'NEEDS_COACH_REVIEW' | 'REUSE_EXISTING' | 'GAP_CONFIRMED'; readonly exerciseGap: ExerciseGap | null
  readonly reusableDefinitionIds: readonly string[]; readonly issues: readonly { readonly code: string; readonly detail: string }[]
  /** A returned assessment is not bearer authority to call Creator or publish. */
  readonly creatorAuthorized: false; readonly libraryApprovalGranted: false; readonly trace: ProgrammingStaffTrace
}
export function workoutExerciseGapAssessmentContract(research: WorkoutExerciseGapResearch): {
  readonly outputSchema: Record<string, unknown>; parseOutput(raw: unknown): ExerciseGapJudgment
}
export function assessWorkoutExerciseGap(args: { readonly pool: LibraryReadPool; readonly context: { readonly facilityId: string | number; readonly userId: string | number };
  readonly rawInput: WorkoutExerciseGapResearchInput; readonly registry: ProgrammingStaffRegistry; readonly runOptions?: ProgrammingStaffRunOptions;
  /** Internal shared budget when assessment is part of the proposal workflow. */
  readonly staffRun?: ProgrammingStaffRun }): Promise<WorkoutExerciseGapAssessment>
