import type { LibraryReadPool, LibraryReadClient } from './workoutProgrammingLibrarians.js'
import type { WorkoutProgrammingWorkflowResult } from './workoutProgrammingWorkflow.js'
import type { ProgrammingWorkoutEnvelope } from './workoutProgrammingStorageContract.js'
export interface SavedProgrammingWorkout {
  readonly persistedWorkoutId: string; readonly createdBy: string | null; readonly createdAt: string
  readonly workout: ProgrammingWorkoutEnvelope; readonly validationFreshness: 'at_save' | 'historical_snapshot'; readonly requiresRevalidation: boolean
}
type Context = { readonly facilityId: number | string; readonly userId: number | string }
export function persistWorkoutProgrammingRun(args: { readonly pool: LibraryReadPool; readonly context: Context;
  readonly workflow: WorkoutProgrammingWorkflowResult; readonly signal?: AbortSignal }): Promise<SavedProgrammingWorkout>
export function loadWorkoutProgrammingRun(pool: LibraryReadPool, context: Context, id: string): Promise<SavedProgrammingWorkout | null>
export function loadWorkoutProgrammingRunInSnapshot(client: LibraryReadClient, context: Context, id: string): Promise<SavedProgrammingWorkout | null>
export function revalidateWorkoutProgrammingRun(pool: LibraryReadPool, context: Context, id: string, options?: { readonly signal?: AbortSignal }): Promise<{
  readonly persistedWorkoutId: string; readonly savedContentHash: string; readonly checkedAt: string; readonly status: ProgrammingWorkoutEnvelope['status']
  readonly validatedWorkout: boolean; readonly requiresRevalidation: boolean; readonly validation: ProgrammingWorkoutEnvelope['validation']
  readonly creatorAuthorized: false; readonly libraryApprovalGranted: false
} | null>
export interface ProgrammingWorkoutListItem {
  readonly persistedWorkoutId: string; readonly createdBy: string | null; readonly createdAt: string; readonly status: ProgrammingWorkoutEnvelope['status']
  readonly revision: string; readonly objective: string; readonly logistics: ProgrammingWorkoutEnvelope['intent']['logistics']; readonly summary: string; readonly requiresRevalidation: true
}
export interface ProgrammingWorkoutCursor { readonly createdAt: string; readonly id: string }
export function listWorkoutProgrammingRuns(pool: LibraryReadPool, context: Context, options?: {
  readonly limit?: number; readonly before?: ProgrammingWorkoutCursor | null
}): Promise<{ readonly items: readonly ProgrammingWorkoutListItem[]; readonly nextCursor: ProgrammingWorkoutCursor | null }>
