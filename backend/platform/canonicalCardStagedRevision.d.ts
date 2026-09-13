import type { CanonicalCard, CanonicalDeliveryProfile } from '../../src/components/coach/canonicalCardTypes.js'
import type { LibraryReadClient, LibraryReadPool } from './workoutProgrammingLibrarians.js'
import type { QuarantinedExerciseProposal } from './workoutExerciseProposal.js'
import type { StagedCanonicalReviewInput, StagedCanonicalReviewEvidence, StagedCanonicalReviewStatus } from './canonicalStagedReviewEvidence.js'

export interface StagedCanonicalScope { readonly facilityId: string; readonly userId: string }
export interface StagedCanonicalOrigin { readonly draftAuditId: string; readonly proposalHash: string }
export interface StagedCanonicalEvent {
  readonly schemaVersion: '1.0.0'; readonly workflow: 'canonical_card_staged_revision_v1'; readonly stagedRevisionId: string
  readonly eventId: string; readonly parentEventId: string | null; readonly definitionId: string; readonly facilityId: string
  readonly source: { readonly cardVersion: number; readonly contentHash: string }; readonly sourceCard: Readonly<CanonicalCard>
  readonly target: { readonly variantId: string; readonly profileKey: string; readonly phaseKey: string }; readonly origin: StagedCanonicalOrigin
  readonly card: Readonly<CanonicalCard> & { readonly id: string; readonly cardVersion: number; readonly status: 'draft' }
  readonly readiness: { readonly ready: boolean; readonly issues: readonly { readonly code: string; readonly path?: string; readonly message: string }[] }
  readonly testPacket: Readonly<Record<string, unknown>>; readonly state: 'draft' | 'review' | 'archived'
  readonly action: 'revision_staged' | 'revision_edited' | 'revision_submitted' | 'revision_returned' | 'revision_archived' | 'revision_reviewed'
  readonly reviewEvidence?: readonly StagedCanonicalReviewEvidence[]
  readonly actorUserId: string; readonly contributorUserIds: readonly string[]; readonly humanReviewRequired: true; readonly libraryApprovalGranted: false
  readonly contentHash: string; readonly revisionNumber: number; readonly createdAt: string
}
export interface StagedCanonicalRevisionView {
  readonly event: StagedCanonicalEvent; readonly sourceMatches: boolean; readonly liveSourceVersion: number | null; readonly liveSourceStatus: string | null
  readonly review: StagedCanonicalReviewStatus
  readonly reviewAccess: { readonly canReview: boolean; readonly canApprove: boolean; readonly reason: 'source_changed' | 'not_submitted' | 'independent_reviewer_required' | null }
}
export type StagedCanonicalRevisionChange = { readonly expectedEventHash: string; readonly changeSummary: string } & (
  { readonly action: 'edit'; readonly profile: CanonicalDeliveryProfile } | { readonly action: 'submit' | 'return' | 'archive' })
export function canonicalStagedSourceCard(card: CanonicalCard): Readonly<CanonicalCard>
export function stageCanonicalDeliveryProfileInTransaction(client: LibraryReadClient, scope: StagedCanonicalScope, sourceCard: CanonicalCard,
  proposal: Extract<QuarantinedExerciseProposal, { readonly kind: 'delivery_profile' }>, origin: StagedCanonicalOrigin): Promise<StagedCanonicalEvent>
export function readStagedCanonicalRevisionInTransaction(client: LibraryReadClient, scope: StagedCanonicalScope, stagedRevisionId: string): Promise<StagedCanonicalEvent | null>
export function findStagedCanonicalRevisionForProposal(client: LibraryReadClient, scope: StagedCanonicalScope, draftAuditId: string, proposalHash: string): Promise<StagedCanonicalEvent | null>
export function loadStagedCanonicalRevision(pool: LibraryReadPool, context: { readonly facilityId: string | number; readonly userId: string | number }, id: string): Promise<StagedCanonicalRevisionView | null>
export function normalizeStagedCanonicalRevisionChange(raw: unknown): StagedCanonicalRevisionChange
export function changeStagedCanonicalRevision(pool: LibraryReadPool, context: { readonly facilityId: string | number; readonly userId: string | number }, id: string,
  input: StagedCanonicalRevisionChange): Promise<StagedCanonicalEvent | null>
export function reviewStagedCanonicalRevision(pool: LibraryReadPool, context: { readonly facilityId: string | number; readonly userId: string | number }, id: string,
  input: StagedCanonicalReviewInput): Promise<StagedCanonicalEvent | null>
