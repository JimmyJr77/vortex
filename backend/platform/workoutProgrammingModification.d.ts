import type { NormalizedCoachWorkoutRequest, CoachWorkoutRequest } from './workoutProgrammingRequest.js'
import type { SavedProgrammingWorkout } from './workoutProgrammingRepository.js'
import type { SessionComponentKey } from './sessionComponentContract.js'
import type { LibraryReadPool, LibraryReadClient, ProgrammingResourceSearch, CanonicalExerciseReference } from './workoutProgrammingLibrarians.js'
import type { ProgrammingBuilderProposal, WorkoutProgrammingDraft, ProgrammingCompositionIssue } from './workoutProgrammingBuilder.js'
import type { CanonicalProgrammingDose, ProgrammingDoseProposal } from './canonicalProgrammingDose.js'
import type { ProgrammingSessionSchedule } from './workoutResourceScheduler.js'

export interface ProgrammingModificationContext {
  readonly schemaVersion: '1.0.0'; readonly sourceWorkoutId: string; readonly sourceRevision: string; readonly sourceContentHash: string
  readonly sourceRequestHash: string; readonly sourceDraftId: string; readonly requestHash: string; readonly constraintsHash: string
  readonly sourceBuilderReviewed: boolean
  readonly requestedComponentKeys: readonly SessionComponentKey[]
  readonly mutableComponentKeys: readonly Exclude<SessionComponentKey, 'prepare_and_access'>[]
  readonly preservedComponentKeys: readonly Exclude<SessionComponentKey, 'prepare_and_access'>[]
  readonly globalControlsChanged: boolean
}
type LockedDose = Pick<CanonicalProgrammingDose, 'sets' | 'reps' | 'workSeconds' | 'restSeconds' | 'restBetweenRoundsSeconds' | 'tempo' | 'rpe' | 'loadMethod' | 'loadTarget'>
type BlockEdit = NonNullable<NonNullable<CoachWorkoutRequest['modification']>['blockEdits']>[number]
export interface ProgrammingModificationPlan {
  readonly context: ProgrammingModificationContext
  readonly previousProposal: ProgrammingBuilderProposal
  readonly blocks: readonly { readonly blockId: string; readonly componentKey: SessionComponentKey; readonly name: string;
    readonly ref: CanonicalExerciseReference; readonly programmingMethodId: string; readonly dose: LockedDose;
    readonly doseProposal: Required<ProgrammingDoseProposal>; readonly timing: Readonly<Record<string, unknown>> | null;
    readonly lockedFields: readonly ('exercises' | 'method' | 'dose' | 'timing')[]; readonly edit: BlockEdit | null; readonly required: boolean }[]
}
export function compileWorkoutProgrammingModification(request: NormalizedCoachWorkoutRequest, saved: SavedProgrammingWorkout): ProgrammingModificationPlan
export function loadWorkoutProgrammingModification(args: { readonly pool: LibraryReadPool; readonly context: { readonly facilityId: string | number; readonly userId: string | number };
  readonly request: NormalizedCoachWorkoutRequest; readonly expectedContext?: ProgrammingModificationContext | null; readonly snapshotClient?: LibraryReadClient | null }): Promise<ProgrammingModificationPlan | null>
export function modificationResourceSearches(searches: readonly ProgrammingResourceSearch[], plan: ProgrammingModificationPlan | null): readonly ProgrammingResourceSearch[]
export function modificationCapabilityContext(plan: ProgrammingModificationPlan | null): Readonly<Record<string, unknown>> | null
export function modificationProposalContract<T>(base: { readonly outputSchema: object; readonly parseOutput: (raw: unknown) => T }, plan: ProgrammingModificationPlan | null,
  options?: { readonly preparation?: boolean }): { readonly outputSchema: object; readonly parseOutput: (raw: unknown) => T }
export function modificationDoseProposal(plan: ProgrammingModificationPlan | null, sourceBlockId: string | null | undefined): ProgrammingDoseProposal
export function modificationActivityId(plan: ProgrammingModificationPlan, componentKey: SessionComponentKey, index: number, sourceBlockId: string | null | undefined): string
export function validateModificationDose(plan: ProgrammingModificationPlan | null, sourceBlockId: string | null | undefined, dose: CanonicalProgrammingDose): void
export function validateWorkoutProgrammingModification(plan: ProgrammingModificationPlan | null,
  result: Pick<WorkoutProgrammingDraft, 'activities' | 'builderProposal' | 'preparationProposal'> & { readonly schedule: ProgrammingSessionSchedule | null }): readonly ProgrammingCompositionIssue[]
