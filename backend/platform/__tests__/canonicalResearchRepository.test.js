import test from 'node:test'
import assert from 'node:assert/strict'

import {
  reviewCanonicalAlternateAssessment,
  reviewCanonicalMediaCandidate,
  reviewCanonicalSectionEvidence,
  summarizeCanonicalResearchReview,
} from '../canonicalResearchRepository.js'

const IDS = {
  definition: '11111111-1111-4111-8111-111111111111',
  record: '22222222-2222-4222-8222-222222222222',
}

test('media approval requires every external and exact-match review gate', async () => {
  const pool = { async query() { throw new Error('database should not be reached') } }
  await assert.rejects(
    reviewCanonicalMediaCandidate(pool, 1, IDS.definition, IDS.record, 7, {
      decision: 'approved',
      expectedCardVersion: 1,
      linkStatus: 'healthy',
      exactVariantMatch: true,
      embeddingAllowed: true,
      demonstrationQualityScore: 79,
    }),
    /at least 80/,
  )
})

test('review functions bind facility, current card version, reviewer, and controlled decision', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params })
      return { rows: [{ id: params[0], review_status: params[5] }] }
    },
  }
  const evidence = await reviewCanonicalSectionEvidence(
    pool, 3, IDS.definition, IDS.record, 9,
    { decision: 'reviewed', expectedCardVersion: 2 },
  )
  const alternate = await reviewCanonicalAlternateAssessment(
    pool, 3, IDS.definition, IDS.record, 9,
    { decision: 'approved', expectedCardVersion: 2 },
  )
  assert.equal(evidence.review_status, 'reviewed')
  assert.equal(alternate.review_status, 'approved')
  assert.deepEqual(calls[0].params.slice(1, 6), [IDS.definition, 2, 3, 9, 'reviewed'])
  assert.match(calls[0].sql, /definition\.card_version=\$3/)
})

test('stale or cross-facility review targets fail closed as not found', async () => {
  const pool = { async query() { return { rows: [] } } }
  await assert.rejects(
    reviewCanonicalSectionEvidence(
      pool, 3, IDS.definition, IDS.record, 9,
      { decision: 'reviewed', expectedCardVersion: 2 },
    ),
    (error) => error.status === 404,
  )
})

test('review checklist exposes pending human work without promoting candidates', () => {
  const checklist = summarizeCanonicalResearchReview({
    evidence: [{ section_key: 'identity', review_status: 'reviewed' }],
    mediaCandidates: [{
      review_status: 'candidate',
      link_status: 'healthy',
      embedding_allowed: true,
      exact_variant_match: null,
      demonstration_quality_score: null,
      captions_available: null,
    }],
    alternateAssessments: [{
      review_status: 'candidate',
      classification: 'new_definition',
      distinguishing_dimensions: {
        targetDefinitionId: IDS.definition,
        targetDefinitionResolution: 'missing_requires_human_triage',
      },
    }],
  })
  assert.equal(checklist.humanReviewRequired, true)
  assert.equal(checklist.readyForPublication, false)
  assert.equal(checklist.evidence.reviewedSections, 1)
  assert.equal(checklist.media.approvedCount, 0)
  assert.equal(checklist.media.accessibilityMetadataPendingCount, 1)
  assert.equal(checklist.alternates.pendingReviewCount, 1)
  assert.equal(checklist.alternates.proposedNewDefinitionCount, 1)
  assert.equal(checklist.alternates.newDefinitionWithDirectPlanCount, 1)
  assert.equal(checklist.alternates.newDefinitionWithoutCardPlanCount, 0)
  assert.equal(checklist.alternates.unresolvedTargetReferenceCount, 1)
  assert.ok(checklist.blockers.some((item) => item.code === 'EXACT_MEDIA_REVIEW_PENDING'))
  assert.ok(checklist.blockers.some((item) => item.code === 'MEDIA_ACCESSIBILITY_METADATA_PENDING'))
  assert.ok(checklist.blockers.some((item) => item.code === 'NEW_DEFINITION_TRIAGE_PENDING'))
})
