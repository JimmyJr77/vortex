import type { ComponentEquipmentPreferences, SessionComponentKey } from './sessionComponentContract.js'
import type { CanonicalSchedulingCard, CanonicalSchedulingMethod } from './canonicalProgrammingDose.js'
import type { NormalizedCoachWorkoutRequest } from './workoutProgrammingRequest.js'
import type { ProgrammingAthleteEvidence } from './workoutAthleteEvidence.js'

export type DeliveryPhaseKey = 'prepare_and_access' | 'movement_intelligence' | 'output'
  | 'capacity' | 'resilience' | 'sustained_capacity' | 'restore'
export interface CanonicalExerciseReference {
  readonly exerciseCardId: string
  readonly variantId: string
  readonly deliveryProfileId: string
  readonly cardVersion: number
}
export interface ProgrammingResourceSearch {
  /** Runtime-validated existing canonical workout intent, including group/clock context. */
  readonly intent: unknown
  readonly requestRevision: string
  readonly componentKey: SessionComponentKey
  /** Explicit metadata search phases; these do not change session component order. */
  readonly phaseKeys: readonly DeliveryPhaseKey[]
  readonly equipment?: ComponentEquipmentPreferences
  /** Waves require later exact scheduling. Neither mode proves group feasibility. */
  readonly equipmentScheduling?: 'simultaneous' | 'waves'
  readonly downstreamExercises?: readonly CanonicalExerciseReference[]
  readonly preferredProgrammingMethodIds?: readonly string[]
  readonly excludedProgrammingMethodIds?: readonly string[]
  readonly pinnedExercises?: readonly CanonicalExerciseReference[]
  readonly preferredExercises?: readonly CanonicalExerciseReference[]
  readonly pinnedProgrammingMethodIds?: readonly string[]
  /** Ranked shortlist size. Eligible pinned records are included beyond this limit. */
  readonly limit?: number
}
export interface ExerciseSearchCandidate {
  readonly ref: CanonicalExerciseReference
  readonly name: string
  readonly phaseKey: DeliveryPhaseKey
  readonly score: number
  readonly scoreComponents: Readonly<Record<string, number>>
  readonly rationale: string
  readonly unknownQuantityKeys: readonly string[]
}
export interface ProgrammingSearchCandidate {
  readonly programmingMethodId: string
  readonly name: string
  readonly phaseKey: DeliveryPhaseKey
  readonly phaseRole: 'primary' | 'secondary' | 'conditional'
  /** Relative ranking points from existing block scoring, not a 1–100 safety score. */
  readonly score: number
  readonly scoreComponents: Readonly<Record<string, number>>
  readonly rationale: string
  readonly requiresBlockValidation: true
}
export interface ProgrammingResourceSearchResult {
  readonly schemaVersion: '1.0.0'
  readonly searchAuditId: string
  readonly requestRevision: string
  readonly requestHash: string
  readonly componentKey: SessionComponentKey
  readonly libraryRelease: { readonly id: string; readonly version: string; readonly ruleVersion: string } | null
  readonly exercises: {
    readonly status: 'MATCHES' | 'NO_ELIGIBLE_MATCH' | 'LIBRARY_UNAVAILABLE'
    readonly candidates: readonly ExerciseSearchCandidate[]
    readonly eligibleCount: number
    readonly searchedVariantCount: number
    readonly rejectionCounts: Readonly<Record<string, number>>
    readonly rejectedCount: number
    readonly rejectionSamples: readonly {
      readonly ref: Omit<CanonicalExerciseReference, 'deliveryProfileId'> & { readonly deliveryProfileId: string | null }
      readonly phaseKey: DeliveryPhaseKey
      readonly reasons: readonly string[]
    }[]
    readonly rejectionSamplesTruncated: boolean
    readonly releaseStatus: 'ready' | 'no_published_release' | 'no_eligible_released_cards'
    readonly unavailablePinnedExercises: readonly CanonicalExerciseReference[]
  }
  readonly programming: {
    readonly status: 'MATCHES' | 'NO_ELIGIBLE_MATCH' | 'SEARCH_INCOMPLETE'
    readonly candidates: readonly ProgrammingSearchCandidate[]
    readonly eligibleCount: number
    readonly searchedMethodCount: number
    readonly searchComplete: boolean
    readonly rejections: readonly { readonly programmingMethodId: string; readonly phaseKey: DeliveryPhaseKey; readonly reasons: readonly string[] }[]
    readonly rejectionsTruncated: boolean
    readonly missingPreferredMethodIds: readonly string[]
    readonly unavailablePinnedProgrammingMethodIds: readonly string[]
  }
  readonly exerciseGap: null
  readonly creatorAuthorized: false
  readonly nextAction: 'review_library_release' | 'review_constraints_and_library_coverage'
    | 'complete_programming_search' | 'review_programming_coverage' | 'compose_and_validate_session'
}
export interface LibraryReadClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
  release(error?: Error): void
}
export interface LibraryReadPool { connect(): Promise<LibraryReadClient> }
export function searchWorkoutProgrammingResources(
  pool: LibraryReadPool,
  context: { readonly facilityId: number | string; readonly userId: number | string },
  raw: ProgrammingResourceSearch,
): Promise<ProgrammingResourceSearchResult>
export function searchWorkoutProgrammingResourcesBatch(
  pool: LibraryReadPool,
  context: { readonly facilityId: number | string; readonly userId: number | string },
  raw: readonly ProgrammingResourceSearch[],
): Promise<readonly ProgrammingResourceSearchResult[]>
export interface WorkoutProgrammingMaterials {
  readonly athleteEvidence: ProgrammingAthleteEvidence | null
  readonly resources: readonly ProgrammingResourceSearchResult[]
  readonly library: readonly CanonicalSchedulingCard[]
  readonly methods: readonly CanonicalSchedulingMethod[]
  readonly release: Readonly<Record<string, unknown>> | null
  readonly libraryStatus: 'ready' | 'no_published_release' | 'no_eligible_released_cards'
  readonly programmingSearchComplete: boolean
}
export function loadWorkoutProgrammingMaterials(pool: LibraryReadPool,
  context: { readonly facilityId: number | string; readonly userId: number | string },
  raw: readonly ProgrammingResourceSearch[], options?: { readonly athleteRequest?: NormalizedCoachWorkoutRequest | null }): Promise<WorkoutProgrammingMaterials>
