import type { LibraryReadClient } from './workoutProgrammingLibrarians.js'
export interface CanonicalProgrammingReviewEvidence {
  readonly reviewId: string; readonly reviewerUserId: string; readonly reviewedCardVersion: number; readonly sourceHash: string | null
}
export function canonicalProgrammingReviewRubric(card: { readonly variants: readonly { readonly id?: string; readonly programming?: Readonly<Record<string, unknown>> }[] }, input?: unknown): unknown
export function loadCanonicalProgrammingRuleReviews(client: Pick<LibraryReadClient, 'query'>, facilityId: string | number,
  cards: readonly { readonly id: string; readonly variantId: string; readonly cardVersion: number; readonly programming?: Readonly<Record<string, unknown>> }[]): Promise<Map<string, CanonicalProgrammingReviewEvidence>>
