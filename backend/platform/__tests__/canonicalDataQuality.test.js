import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCanonicalDataQualityReport,
  recordAiIntentAudit,
  recordCanonicalCoachReview,
} from '../canonicalDataQuality.js'

test('data-quality report exposes coverage, zero-depth phases, graph, and coach pilot rates', async () => {
  let call = 0
  const queries = []
  const pool = {
    async query(sql) {
      call += 1
      queries.push(sql)
      if (call === 1) return { rows: [{
        total_definitions: 100, published_definitions: 80, published_current_card_review_definitions: 78, published_verified_manual_media_definitions: 76, video_complete: 90,
        confidence_complete: 75, with_published_variant: 85,
        with_published_profile: 70, score_complete: 65,
        total_variants: 120, structured_profile_complete_variants: 60,
        structured_profile_approved_variants: 30,
        published_variants: 80, published_structured_profile_complete_variants: 72,
        published_structured_profile_approved_variants: 64,
        research_candidate_sections_complete: 45,
        research_sections_complete: 40,
        research_candidate_section_count: 960,
        research_reviewed_section_count: 800,
        media_candidate_set_complete: 30, media_embeddable_candidate_set_complete: 25,
        media_approved_set_complete: 20,
        alternates_candidate_assessed: 55, alternates_reviewed: 35,
      }] }
      if (call === 2) return { rows: [
        { phase_key: 'prepare_and_access', candidate_count: 12 },
        { phase_key: 'capacity', candidate_count: 20 },
      ] }
      if (call === 3) return { rows: [{ total_edges: 50, approved_edges: 40, connected_variants: 30 }] }
      if (call === 4) return { rows: [{ review_count: 10, keep_minor_count: 9, exercise_count: 100, swap_count: 8, dose_edit_count: 12 }] }
      return { rows: [{
        draft_cards: 4, cards_in_review: 3, media_failures: 2,
        media_reviews_due: 5, relationships_in_review: 6,
        calibrations_in_review: 7, approved_calibration_anchors: 12,
        exact_identity_collisions: 1,
        structured_profiles_pending_review: 90,
        structured_profile_pending_variant_ids: ['variant-1', 'variant-2'],
      }] }
    },
  }
  const report = await buildCanonicalDataQualityReport(pool, 7)
  assert.equal(report.coverage.publicationPercent, 80)
  assert.equal(report.coverage.publishedCurrentCardReviewPercent, 97.5)
  assert.equal(report.coverage.publishedVerifiedManualMediaPercent, 95)
  assert.equal(report.coverage.scoreCompletePercent, 65)
  assert.equal(report.coverage.structuredProfileCompletePercent, 50)
  assert.equal(report.coverage.structuredProfileApprovedPercent, 25)
  assert.equal(report.coverage.publishedVariants, 80)
  assert.equal(report.coverage.publishedStructuredProfileCompletePercent, 90)
  assert.equal(report.coverage.publishedStructuredProfileApprovedPercent, 80)
  assert.equal(report.coverage.researchCandidateCardsCompletePercent, 45)
  assert.equal(report.coverage.researchSectionsCompletePercent, 40)
  assert.equal(report.coverage.researchCandidateSectionCoveragePercent, 60)
  assert.equal(report.coverage.researchReviewedSectionCoveragePercent, 50)
  assert.equal(report.coverage.mediaCandidateSetCompletePercent, 30)
  assert.equal(report.coverage.mediaEmbeddableCandidateSetCompletePercent, 25)
  assert.equal(report.coverage.mediaApprovedSetCompletePercent, 20)
  assert.equal(report.coverage.alternatesCandidateAssessedPercent, 55)
  assert.equal(report.coverage.alternatesReviewedPercent, 35)
  assert.equal(report.coachPilot.keepOrMinorEditPercent, 90)
  assert.equal(report.coachPilot.swapPercent, 8)
  assert.equal(report.governance.mediaReviewsDue, 5)
  assert.equal(report.governance.calibrationsInReview, 7)
  assert.equal(report.governance.approvedCalibrationAnchors, 12)
  assert.equal(report.governance.exactIdentityCollisions, 1)
  assert.equal(report.governance.structuredProfilesPendingReview, 90)
  assert.deepEqual(report.governance.structuredProfilePendingVariantIds, ['variant-1', 'variant-2'])
  assert.match(queries[0], /difficulty_json \? 'absoluteLoadDemand'/)
  assert.match(queries[0], /published_verified_manual_media_definitions/)
  assert.match(queries[0], /published_current_card_review_definitions/)
  assert.match(queries[0], /length\(btrim\(approved_card_review\.notes\)\) >= 20/)
  assert.match(queries[0], /review_basis_json @> jsonb_build_object/)
  assert.match(queries[0], /exercise_structured_profile_review_v2 structured_evidence/)
  assert.match(queries[2], /length\(btrim\(review_evidence\.notes\)\) >= 20/)
  assert.match(queries[2], /exercise_relationship_review_v2/)
  assert.match(queries[0], /GREATEST\(/)
  assert.match(queries[4], /WITH identity_names AS/)
  assert.match(queries[4], /ARRAY\[identity_definition\.canonical_name, identity_definition\.display_name\]/)
  assert.match(queries[4], /COALESCE\(identity_definition\.aliases/)
  assert.match(queries[4], /CROSS JOIN LATERAL unnest/)
  assert.match(queries[4], /GROUP BY left_name\.definition_id, right_name\.definition_id/)
  assert.ok(report.zeroDepthPhases.includes('restore'))
})

test('coach review validates scores, reason codes, and edit counts before storage', async () => {
  const pool = { async query(_sql, params) { return { rows: [{ id: 'review-1', params }] } } }
  const saved = await recordCanonicalCoachReview(pool, 'workout-1', 4, {
    outcome: 'minor_edit',
    safetyScore: 100,
    overallScore: 92,
    exerciseCount: 10,
    swapCount: 1,
    doseEditCount: 1,
    editReasons: ['dosage'],
  })
  assert.equal(saved.id, 'review-1')
  await assert.rejects(
    recordCanonicalCoachReview(pool, 'workout-1', 4, {
      outcome: 'keep', exerciseCount: 2, swapCount: 3,
    }),
    /cannot exceed/,
  )
})

test('AI audit stores hashes and structured metadata without raw coach request', async () => {
  let captured
  const pool = { async query(_sql, params) { captured = params; return { rows: [] } } }
  await recordAiIntentAudit(pool, {
    facilityId: 7,
    userId: 4,
    requestHash: 'abc123',
    modelVersion: 'model-1',
    status: 'validated',
    interpretedIntent: { objective: 'strength_priority' },
    latencyMs: 125,
    usage: { inputTokens: 10, outputTokens: 20 },
  })
  assert.equal(captured[2], 'abc123')
  assert.equal(captured[4], 'validated')
  assert.ok(!captured.includes('raw coach request'))
})
