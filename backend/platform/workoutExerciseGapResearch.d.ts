import type { CoachWorkoutRequest, NormalizedCoachWorkoutRequest } from './workoutProgrammingRequest.js'
import type { SessionComponentKey } from './sessionComponentContract.js'
import type { LibraryReadPool, LibraryReadClient, ProgrammingResourceSearchResult } from './workoutProgrammingLibrarians.js'
import type { ProgrammingModificationContext } from './workoutProgrammingModification.js'
import type { filterProgrammingCandidateEligibility } from './workoutProgrammingEligibility.js'
import type { ProgrammingAthleteEvidence } from './workoutAthleteEvidence.js'

export interface WorkoutExerciseDemand {
  readonly canonicalName: string; readonly description: string; readonly aliases: readonly string[]; readonly familyKey: string | null
  readonly movementPatterns: readonly string[]; readonly bodyRegions: readonly string[]; readonly requiredEquipment: readonly string[]
}
export interface WorkoutExerciseGapResearchInput {
  readonly request: CoachWorkoutRequest; readonly componentKey: SessionComponentKey; readonly need: WorkoutExerciseDemand
}
export interface ExerciseResearchDefinition {
  readonly id: string; readonly canonicalName: string; readonly displayName: string; readonly aliases: readonly string[]
  readonly familyKey: string; readonly description: string | null; readonly cardVersion: number; readonly status: string
  readonly movementPatterns: readonly string[]; readonly bodyRegions: readonly string[]; readonly requiredEquipment: readonly string[]
  readonly variants: readonly { readonly id: string; readonly key: string; readonly name: string; readonly status: string }[]
  readonly profiles: readonly { readonly id: string; readonly variantId: string; readonly key: string; readonly phaseKey: string;
    readonly role: string; readonly purpose: string; readonly status: string; readonly equipmentRequired: readonly string[] }[]
  readonly score: number; readonly matches: { readonly identityScore: number; readonly exactIdentity: boolean; readonly family: boolean;
    readonly movementPatterns: readonly string[]; readonly bodyRegions: readonly string[]; readonly phaseKeys: readonly string[]; readonly incompleteClassification: boolean }
  readonly inCurrentRelease: boolean; readonly releasedVariantIds: readonly string[]; readonly eligibleProfileIds: readonly string[]
}
export interface WorkoutExerciseGapResearch {
  readonly schemaVersion: '1.0.0'; readonly researchAuditId: string; readonly requestRevision: string; readonly requestHash: string
  readonly researchHash: string; readonly componentKey: SessionComponentKey; readonly need: WorkoutExerciseDemand
  readonly scope: { readonly facilityId: string; readonly userId: string }; readonly sourceHash: string
  readonly sources: { readonly catalogHash: string; readonly taxonomyIssues: Readonly<Record<string, readonly string[]>>;
    readonly release: ProgrammingResourceSearchResult['libraryRelease']; readonly libraryHash: string; readonly programmingHash: string;
    readonly athleteEvidenceHash: string; readonly parent: ProgrammingModificationContext | null }
  readonly coverage: { readonly catalogSearchComplete: boolean; readonly catalogRowCount: number; readonly definitionCount: number;
    readonly relatedDefinitionCount: number; readonly evidenceTruncated: boolean; readonly programmingSearchComplete: boolean;
    readonly includesAllLifecycleStates: true; readonly contextualConstraintsAppliedToCatalog: false }
  readonly status: 'RESEARCH_REQUIRES_REVIEW' | 'RESEARCH_READY_FOR_CONTENT_REVIEW'
  readonly relatedDefinitions: readonly ExerciseResearchDefinition[]; readonly resources: ProgrammingResourceSearchResult
  readonly eligibility: ReturnType<typeof filterProgrammingCandidateEligibility>['reports']; readonly athleteFindings: ProgrammingAthleteEvidence['findings']
  readonly issues: readonly { readonly code: string; readonly detail: string }[]
  readonly exerciseGap: null; readonly creatorAuthorized: false; readonly libraryApprovalGranted: false
}
export function normalizeWorkoutExerciseGapResearchInput(raw: unknown): Omit<WorkoutExerciseGapResearchInput, 'request'> & { readonly request: NormalizedCoachWorkoutRequest }
export function researchWorkoutExerciseGap(pool: LibraryReadPool, context: { readonly facilityId: string | number; readonly userId: string | number },
  rawInput: WorkoutExerciseGapResearchInput): Promise<WorkoutExerciseGapResearch>
export function researchWorkoutExerciseGapInSnapshot(client: LibraryReadClient, context: { readonly facilityId: string | number; readonly userId: string | number },
  rawInput: WorkoutExerciseGapResearchInput): Promise<WorkoutExerciseGapResearch>
