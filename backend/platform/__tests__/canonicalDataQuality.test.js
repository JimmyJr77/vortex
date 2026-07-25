import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCanonicalDataQualityReport,
  recordAiIntentAudit,
  recordCanonicalCoachReview,
} from '../canonicalDataQuality.js'

test('data-quality report exposes coverage, zero-depth phases, graph, and coach pilot rates', async () => {
  let call = 0
  const pool = {
    async query() {
      call += 1
      if (call === 1) return { rows: [{
        total_definitions: 100, published_definitions: 80, video_complete: 90,
        confidence_complete: 75, with_published_variant: 85,
        with_published_profile: 70, score_complete: 65,
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
      }] }
    },
  }
  const report = await buildCanonicalDataQualityReport(pool, 7)
  assert.equal(report.coverage.publicationPercent, 80)
  assert.equal(report.coverage.scoreCompletePercent, 65)
  assert.equal(report.coachPilot.keepOrMinorEditPercent, 90)
  assert.equal(report.coachPilot.swapPercent, 8)
  assert.equal(report.governance.mediaReviewsDue, 5)
  assert.equal(report.governance.calibrationsInReview, 7)
  assert.equal(report.governance.approvedCalibrationAnchors, 12)
  assert.equal(report.governance.exactIdentityCollisions, 1)
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
