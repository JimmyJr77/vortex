import type { LibraryReadPool, DeliveryPhaseKey } from './workoutProgrammingLibrarians.js'
import type { WorkoutExerciseGapResearchInput } from './workoutExerciseGapResearch.js'
import type { WorkoutExerciseGapAssessment, ExerciseGap } from './workoutExerciseGapAssessment.js'
import type { ProgrammingStaffRegistry, ProgrammingStaffRunOptions, ProgrammingStaffTrace } from './programmingStaffRuntime.js'
import type { StagedCanonicalEvent } from './canonicalCardStagedRevision.js'

/** Existing normalized profile fields; remaining canonical metadata stays schema-owned. */
export interface QuarantinedExerciseProfile {
  readonly id: null; readonly profileKey: string; readonly phaseKey: DeliveryPhaseKey; readonly role: 'primary'; readonly purpose: string
  readonly phaseSuitability: number; readonly methodologyAlignment: number; readonly qualityGate: string; readonly stopRules: readonly string[]
  readonly coachInstructions: string; readonly athleteInstructions: string; readonly expectedAdaptation: string; readonly equipmentRequired: readonly string[]
  readonly dosage: { readonly sets: readonly [number, number]; readonly reps: readonly [number, number] | null; readonly workSeconds: number | null; readonly restSeconds: number }
  readonly [canonicalField: string]: unknown
}
export interface ExerciseProposalProvenance {
  readonly source: 'ai_assisted_draft'; readonly modelVersion: string | null; readonly humanReviewRequired: true
  readonly assumptions: readonly string[]; readonly uncertainties: readonly string[]
}
export interface QuarantinedExerciseCard {
  readonly status: 'draft'; readonly canonicalName: string; readonly displayName: string; readonly slug: string; readonly aliases: readonly string[]
  readonly familyKey: string; readonly movementPatterns: readonly string[]; readonly bodyRegions: readonly string[]
  readonly requiredEquipment: readonly string[]; readonly optionalEquipment: readonly string[]; readonly contentConfidence: number; readonly scoringConfidence: number
  readonly mediaConfidence: null; readonly approvedVideoUrl: null; readonly provenance: ExerciseProposalProvenance
  readonly variants: readonly { readonly variantKey: string; readonly displayName: string; readonly profiles: readonly QuarantinedExerciseProfile[];
    readonly difficulty: { readonly technicalComplexity: number; readonly absoluteLoadDemand: number; readonly supervisionDemand: number;
      readonly failureConsequence: number; readonly impact: number; readonly workCapacityDemand: number }; readonly [canonicalField: string]: unknown }[]
  readonly [canonicalField: string]: unknown
}
export type QuarantinedExerciseProposal = { readonly kind: 'new_card'; readonly draft: QuarantinedExerciseCard;
  readonly readiness: { readonly ready: false; readonly issues: readonly Readonly<Record<string, unknown>>[] } }
  | { readonly kind: 'delivery_profile'; readonly target: NonNullable<ExerciseGap['target']>; readonly profile: QuarantinedExerciseProfile;
    readonly provenance: ExerciseProposalProvenance; readonly humanReviewRequired: true }
export interface RecordedExerciseProposal {
  readonly schemaVersion: '1.0.0'; readonly workflow: 'vortex_exercise_proposal_v1'; readonly scope: { readonly facilityId: string; readonly userId: string }
  readonly request: WorkoutExerciseGapResearchInput; readonly assessment: WorkoutExerciseGapAssessment; readonly proposal: QuarantinedExerciseProposal | null
  readonly issues: readonly { readonly code: string; readonly detail: string }[]; readonly trace: ProgrammingStaffTrace
  readonly state: 'AI_PROPOSED' | 'NEEDS_COACH_REVIEW'; readonly canonicalDraftId: null; readonly humanReviewRequired: true; readonly libraryApprovalGranted: false
  readonly contentHash: string; readonly draftAuditId: string; readonly createdAt: string
}
export type ExerciseProposalResult = RecordedExerciseProposal | { readonly state: 'REUSE_EXISTING' | 'NEEDS_COACH_REVIEW'; readonly assessment: WorkoutExerciseGapAssessment;
  readonly proposal: null; readonly draftAuditId: null; readonly humanReviewRequired: true; readonly libraryApprovalGranted: false; readonly trace: ProgrammingStaffTrace }
export function proposeWorkoutExercise(args: { readonly pool: LibraryReadPool; readonly context: { readonly facilityId: string | number; readonly userId: string | number };
  readonly rawInput: WorkoutExerciseGapResearchInput; readonly registry: ProgrammingStaffRegistry; readonly runOptions?: ProgrammingStaffRunOptions }): Promise<ExerciseProposalResult>
export function loadWorkoutExerciseProposal(pool: LibraryReadPool, context: { readonly facilityId: string | number; readonly userId: string | number }, id: string): Promise<RecordedExerciseProposal | null>

/** The human accepts exactly the stored proposal. Edited cards, scopes and approval flags are forbidden. */
export interface ExerciseProposalAcceptanceInput { readonly expectedProposalHash: string }
export interface AcceptedExerciseProposal {
  readonly draftAuditId: string; readonly proposalHash: string; readonly canonicalCardId: string; readonly cardVersion: number
  /** Current lifecycle status on retries; acceptance itself only creates a draft. */
  readonly status: 'draft' | 'review' | 'published' | 'deprecated' | 'archived'
  readonly acceptedBy: string; readonly acceptedAt: string; readonly alreadyAccepted: boolean; readonly libraryApprovalGranted: false
}
export interface ExerciseProposalReview { readonly record: RecordedExerciseProposal; readonly acceptance: AcceptedExerciseProposal | null }
export interface ExerciseProposalCursor { readonly id: string; readonly createdAt: string }
export interface ExerciseProposalPage {
  readonly items: readonly { readonly draftAuditId: string; readonly createdAt: string; readonly name: string;
    readonly componentKey: WorkoutExerciseGapResearchInput['componentKey']; readonly state: RecordedExerciseProposal['state'];
    readonly kind: QuarantinedExerciseProposal['kind'] | null }[]
  readonly nextCursor: ExerciseProposalCursor | null
}
export function reviewWorkoutExerciseProposal(pool: LibraryReadPool, context: { readonly facilityId: string | number; readonly userId: string | number }, id: string): Promise<ExerciseProposalReview | null>
export function listWorkoutExerciseProposals(pool: LibraryReadPool, context: { readonly facilityId: string | number; readonly userId: string | number },
  options?: { readonly limit?: number; readonly before?: ExerciseProposalCursor | null }): Promise<ExerciseProposalPage>
export function normalizeExerciseProposalAcceptanceInput(raw: unknown): ExerciseProposalAcceptanceInput
export function acceptWorkoutExerciseProposal(pool: LibraryReadPool, context: { readonly facilityId: string | number; readonly userId: string | number }, id: string,
  input: ExerciseProposalAcceptanceInput): Promise<AcceptedExerciseProposal | null>
export function stageWorkoutExerciseProposal(pool: LibraryReadPool, context: { readonly facilityId: string | number; readonly userId: string | number }, id: string,
  input: ExerciseProposalAcceptanceInput): Promise<{ readonly event: StagedCanonicalEvent; readonly alreadyStaged: boolean } | null>
export function loadWorkoutExerciseProposalRevision(pool: LibraryReadPool, context: { readonly facilityId: string | number; readonly userId: string | number }, id: string): Promise<StagedCanonicalEvent | null>
