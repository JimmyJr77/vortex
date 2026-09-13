import { PRODUCTION_REFERENCE_CARD_DRAFT } from '../canonicalReferenceCard.js'
import { normalizeCanonicalCardDraft } from '../canonicalCardAuthoring.js'
import { canonicalStagedSourceCard } from '../canonicalCardStagedRevision.js'
import { programmingValueHash } from '../workoutProgrammingRequest.js'
import { uuid } from './workoutProgrammingLibrarianFixtures.js'
import { TAXONOMY_V2_FACETS } from '../taxonomyV2.js'

/** Synthetic complete content/governance fixtures only; no production approval or release claim. */
export function stagedReviewEvidenceFixture() {
  const reference = normalizeCanonicalCardDraft(structuredClone(PRODUCTION_REFERENCE_CARD_DRAFT))
  const source = { ...reference, id: uuid(601), cardVersion: 1, status: 'published', createdBy: 7, approvedBy: 8,
    approvedVideoUrl: 'https://media.example/staged-review-fixture', mediaConfidence: 100, relationships: [], reviews: [] }
  source.variants[0].id = uuid(602); source.variants[0].status = 'published'
  source.variants[0].profiles[0].id = uuid(603); source.variants[0].profiles[0].phaseKey = 'output'
  source.variants[0].profiles[0].status = 'published'
  const card = structuredClone(source)
  card.cardVersion = 2; card.status = 'draft'; card.approvedBy = null; card.reviewedBy = null; card.mediaReview = null
  const profile = structuredClone(card.variants[0].profiles[0])
  delete profile.status
  profile.id = null; profile.profileKey = 'staged-strength'; profile.phaseKey = 'capacity'
  profile.dosage = { sets: [2, 3], reps: [5, 8], workSeconds: 30, restSeconds: 60 }
  for (const records of Object.values(profile.taxonomyV2)) for (const record of records) {
    record.reviewStatus = 'suggested'; delete record.reviewedBy; delete record.reviewedAt
  }
  card.variants[0].profiles.push(profile)
  const event = { schemaVersion: '1.0.0', workflow: 'canonical_card_staged_revision_v1', stagedRevisionId: uuid(610), eventId: uuid(610), parentEventId: null,
    definitionId: source.id, facilityId: '9', source: { cardVersion: 1, contentHash: programmingValueHash(canonicalStagedSourceCard(source)) }, sourceCard: canonicalStagedSourceCard(source),
    target: { variantId: uuid(602), profileKey: profile.profileKey, phaseKey: 'capacity' }, origin: { draftAuditId: uuid(611), proposalHash: 'a'.repeat(64) },
    card, state: 'review', action: 'revision_submitted', actorUserId: '7', contributorUserIds: ['7'], reviewEvidence: [],
    humanReviewRequired: true, libraryApprovalGranted: false }
  const control = { unavailableTerms: new Set() }
  const client = { async query(sql, params = []) {
    if (sql.includes('staged_revision_taxonomy_terms')) return { rows: JSON.parse(params[0]).filter((entry) => !control.unavailableTerms.has(`${entry.facet_type}:${entry.key}`)
      && TAXONOMY_V2_FACETS[entry.facet_type]?.some((term) => term.key === entry.key && term.scopes.includes(entry.subject_scope))) }
    const subjects = [source, ...source.variants, ...source.variants.flatMap((variant) => variant.profiles)]
    if (sql === 'SELECT key FROM coaching.movement_pattern') return { rows: source.movementPatterns.map((key) => ({ key })) }
    if (sql === 'SELECT key FROM coaching.body_region') return { rows: source.bodyRegions.map((key) => ({ key })) }
    if (sql === 'SELECT key FROM coaching.equipment') return { rows: [...new Set(subjects.flatMap((entry) => [...entry.requiredEquipment ?? [], ...entry.optionalEquipment ?? [], ...entry.equipmentRequired ?? []]))].map((key) => ({ key })) }
    throw new Error(`Unsupported staged evidence fixture SQL: ${sql}`)
  } }
  return { event, client, control }
}

export const stagedMediaReviewInput = (event) => ({ kind: 'media', expectedEventHash: 'b'.repeat(64), notes: 'Synthetic observed playback and exact-variant comparison evidence.',
  url: event.card.approvedVideoUrl, exactVariantMatch: true, demonstrationQualityScore: 90, linkStatus: 'healthy',
  reviewBasis: { reviewMethod: 'manual_playback', playbackReviewed: true, exactVariantCompared: true, linkChecked: true, accessibilityChecked: true } })
