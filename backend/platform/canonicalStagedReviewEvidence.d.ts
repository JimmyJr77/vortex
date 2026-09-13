import type { CanonicalCard } from '../../src/components/coach/canonicalCardTypes.js'
import type { StagedCanonicalEvent } from './canonicalCardStagedRevision.js'
import type { LibraryReadClient } from './workoutProgrammingLibrarians.js'

export interface StagedMediaObservation {
  readonly url: string; readonly exactVariantMatch: boolean; readonly demonstrationQualityScore: number
  readonly linkStatus: 'healthy' | 'broken' | 'mismatched'
  readonly reviewBasis: { readonly reviewMethod: 'manual_playback'; readonly playbackReviewed: true; readonly exactVariantCompared: true;
    readonly linkChecked: true; readonly accessibilityChecked: true }
}
export type StagedCanonicalReviewInput = { readonly expectedEventHash: string; readonly notes: string } & (
  { readonly kind: 'taxonomy'; readonly recordType: 'assignment'; readonly facetType: string; readonly termKey: string; readonly outcome: 'approve' | 'reject' }
  | { readonly kind: 'taxonomy'; readonly recordType: 'decision'; readonly facetType: string; readonly termKey?: null; readonly outcome: 'approve' | 'reject' }
  | { readonly kind: 'media' } & StagedMediaObservation
  | { readonly kind: 'card'; readonly decision: 'approve' | 'request_changes'; readonly rubric?: Readonly<Record<string, unknown>> }
)
interface EvidenceIdentity {
  readonly schemaVersion: '1.0.0'; readonly reviewEventId: string; readonly candidateHash: string
  readonly reviewerUserId: string; readonly reviewedAt: string; readonly notes: string
}
export type StagedCanonicalReviewEvidence = EvidenceIdentity & (
  { readonly kind: 'taxonomy'; readonly details: { readonly recordType: 'assignment' | 'decision'; readonly facetType: string;
    readonly termKey: string | null; readonly outcome: 'approved' | 'rejected' } }
  | { readonly kind: 'media'; readonly details: StagedMediaObservation & { readonly reviewedCardVersion: number; readonly nextReviewAt: string } }
  | { readonly kind: 'card'; readonly details: { readonly decision: 'approve' | 'request_changes'; readonly evidenceHash: string; readonly rubric: Readonly<Record<string, unknown>> } }
)
export interface StagedCanonicalReviewStatus {
  readonly candidateHash: string; readonly evidenceHash: string; readonly evidence: readonly StagedCanonicalReviewEvidence[]
  readonly readiness: StagedCanonicalEvent['readiness']; readonly testPacket: Readonly<NonNullable<CanonicalCard['testPacket']>>
  readonly approval: Extract<StagedCanonicalReviewEvidence, { kind: 'card' }> | null
}
export function normalizeStagedCanonicalReviewInput(raw: unknown): StagedCanonicalReviewInput
export function stagedCanonicalCandidateHash(event: StagedCanonicalEvent): string
export function stagedCanonicalProfile(event: StagedCanonicalEvent, card?: CanonicalCard): CanonicalCard['variants'][number]['profiles'][number]
export function assertStagedIndependentReviewer(event: StagedCanonicalEvent, userId: string): void
export function currentStagedReviewEvidence(event: StagedCanonicalEvent): readonly StagedCanonicalReviewEvidence[]
export function replaceStagedReviewEvidence(previous: readonly StagedCanonicalReviewEvidence[], evidence: StagedCanonicalReviewEvidence): readonly StagedCanonicalReviewEvidence[]
export function evaluateStagedCanonicalReview(client: LibraryReadClient, event: StagedCanonicalEvent, now?: Date): Promise<StagedCanonicalReviewStatus & {
  readonly card: CanonicalCard; readonly mediaReview: NonNullable<CanonicalCard['mediaReview']> | null;
}>
export function createStagedCanonicalReviewEvidence(event: StagedCanonicalEvent, input: StagedCanonicalReviewInput, reviewerUserId: string,
  reviewEventId: string, evaluated: StagedCanonicalReviewStatus & { readonly card: CanonicalCard }, now?: Date): StagedCanonicalReviewEvidence
