import type { LibraryReadClient } from './workoutProgrammingLibrarians.js'
import type { NormalizedCoachWorkoutRequest, ProgrammingEvidenceKind, ProgrammingEvidenceReference } from './workoutProgrammingRequest.js'
export const PROGRAMMING_ATHLETE_EVIDENCE_VERSION: '1.0.0'
export interface ProgrammingAthleteObservation {
  readonly kind: ProgrammingEvidenceKind
  readonly id: string
  readonly memberId: string
  readonly observedAt: string
  readonly dateOnly: boolean
  readonly sourceHash: string
  readonly data: Readonly<Record<string, unknown>>
  readonly truncated: boolean
}
export interface ProgrammingAthleteEvidence {
  readonly schemaVersion: '1.0.0'
  readonly referenceDate: string | null
  readonly cohorts: readonly { readonly key: string; readonly memberIds: readonly string[]; readonly anonymous: boolean }[]
  readonly members: readonly { readonly memberId: string; readonly cohortKey: string; readonly athleteKey: string; readonly age: number | null }[]
  readonly observations: readonly ProgrammingAthleteObservation[]
  readonly history: readonly { readonly kind: ProgrammingEvidenceKind; readonly memberId: string;
    readonly availableCount: number; readonly returnedCount: number; readonly truncated: boolean }[]
  readonly retrieval: { readonly previousDays: 35; readonly plannedDays: 35; readonly wellness: 'latest_on_or_before_session_date';
    readonly scope: 'recorded_in_this_facility'; readonly timestampDateBasis: 'UTC'; readonly dateOnlySourceBasis: 'source_calendar_date'; readonly outsideActivityKnown: false }
  readonly findings: readonly { readonly code: string; readonly cohortKey: string; readonly detail: string; readonly reference?: ProgrammingEvidenceReference }[]
  readonly prerequisiteStatus: 'NOT_ESTABLISHED'
  readonly contentHash: string
  readonly status: 'NEEDS_COACH_REVIEW' | 'HYDRATED' | 'ANONYMOUS'
}
/** Internal service; context must be obtained from the authenticated coaching caller. */
export function loadWorkoutAthleteEvidence(client: LibraryReadClient,
  context: { readonly facilityId: number | string; readonly userId: number | string },
  request: NormalizedCoachWorkoutRequest): Promise<ProgrammingAthleteEvidence>
