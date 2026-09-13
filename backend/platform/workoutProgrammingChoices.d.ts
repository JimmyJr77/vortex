import type { LibraryReadPool, CanonicalExerciseReference } from './workoutProgrammingLibrarians.js'
import type { SessionComponentKey } from './sessionComponentContract.js'
export interface WorkoutProgrammingChoices {
  readonly requestHash: string; readonly release: { readonly id: string; readonly version: string; readonly ruleVersion: string } | null
  readonly searchComplete: boolean; readonly findings: readonly { readonly code: string; readonly detail: string }[]
  readonly components: readonly { readonly key: SessionComponentKey; readonly exercises: readonly {
    readonly ref: CanonicalExerciseReference; readonly name: string; readonly purpose: string; readonly methodIds: readonly string[]
    readonly eligibility: 'ELIGIBLE' | 'INELIGIBLE' | 'REQUIRES_REVIEW'; readonly findings: readonly { readonly code: string; readonly message: string }[]
  }[]; readonly methods: readonly { readonly id: string; readonly name: string; readonly type: string; readonly summary: string | null }[] }[]
  readonly creatorAuthorized: false; readonly libraryApprovalGranted: false
}
export function loadWorkoutProgrammingChoices(pool: LibraryReadPool, context: { readonly facilityId: string | number; readonly userId: string | number }, rawRequest: unknown): Promise<WorkoutProgrammingChoices>
