export interface CanonicalMediaReviewDraft {
  score: number | ''
  linkStatus: 'healthy' | 'broken' | 'mismatched' | ''
  exactVariantMatch: boolean | null
  notes: string
  basis: { playbackReviewed: boolean; exactVariantCompared: boolean; linkChecked: boolean; accessibilityChecked: boolean }
}

export const emptyMediaReviewDraft = (): CanonicalMediaReviewDraft => ({
  score: '', linkStatus: '', exactVariantMatch: null, notes: '',
  basis: { playbackReviewed: false, exactVariantCompared: false, linkChecked: false, accessibilityChecked: false },
})

export function mediaReviewDraftComplete(draft: CanonicalMediaReviewDraft): boolean {
  return typeof draft.score === 'number' && Number.isFinite(draft.score) && draft.score >= 1 && draft.score <= 100
    && !!draft.linkStatus && draft.exactVariantMatch != null && draft.notes.trim().length >= 20
    && draft.notes.length <= 2000 && Object.values(draft.basis).every(Boolean)
}
