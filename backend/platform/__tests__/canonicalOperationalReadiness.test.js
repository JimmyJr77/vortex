import test from 'node:test'
import assert from 'node:assert/strict'

import {
  assessCanonicalOperationalReadiness,
  validateAthleteSupportAccessibility,
} from '../canonicalOperationalReadiness.js'
import { PRODUCTION_REFERENCE_CARD_DRAFT } from '../canonicalReferenceCard.js'

function readyReport() {
  return {
    coverage: {
      publishedDefinitions: 50,
      publishedCurrentCardReviewPercent: 100,
      publishedVerifiedManualMediaPercent: 100,
      publishedVariants: 80,
      publishedStructuredProfileCompletePercent: 100,
      publishedStructuredProfileApprovedPercent: 100,
    },
    poolDepthByPhase: {
      prepare_and_access: 5, movement_intelligence: 5, output: 5, capacity: 5,
      resilience: 5, sustained_capacity: 5, restore: 5,
    },
    graph: { approvedEdges: 20 },
    governance: {
      approvedCalibrationAnchors: 5,
      mediaFailures: 0,
      mediaReviewsDue: 0,
      exactIdentityCollisions: 0,
    },
    coachPilot: {
      reviewCount: 25,
      keepOrMinorEditPercent: 92,
      swapPercent: 8,
      doseEditPercent: 12,
    },
  }
}

test('operational readiness passes only when library, graph, governance, and pilot gates pass', () => {
  assert.equal(assessCanonicalOperationalReadiness(readyReport()).status, 'ready')
})

test('operational readiness keeps human evidence gaps explicit and blocking', () => {
  const report = readyReport()
  report.governance.mediaFailures = 2
  report.coachPilot.reviewCount = 0
  const result = assessCanonicalOperationalReadiness(report)
  assert.equal(result.status, 'blocked')
  assert.ok(result.humanGates.some((item) => item.code === 'BROKEN_MEDIA'))
  assert.ok(result.humanGates.some((item) => item.code === 'COACH_PILOT_INCOMPLETE'))
})

test('operational readiness blocks incomplete or unreviewed published structured profiles', () => {
  const incomplete = readyReport()
  incomplete.coverage.publishedStructuredProfileCompletePercent = 98
  let result = assessCanonicalOperationalReadiness(incomplete)
  assert.ok(result.failures.some((item) => item.code === 'PUBLISHED_STRUCTURED_PROFILES_INCOMPLETE'))

  const unreviewed = readyReport()
  unreviewed.coverage.publishedStructuredProfileApprovedPercent = 98
  result = assessCanonicalOperationalReadiness(unreviewed)
  assert.ok(result.humanGates.some((item) => item.code === 'PUBLISHED_STRUCTURED_PROFILES_UNREVIEWED'))
})

test('operational readiness blocks published cards without documented manual media verification', () => {
  const report = readyReport()
  report.coverage.publishedVerifiedManualMediaPercent = 98
  const result = assessCanonicalOperationalReadiness(report)
  assert.ok(result.humanGates.some((item) => item.code === 'PUBLISHED_MEDIA_UNVERIFIED'))
})

test('operational readiness blocks published cards without a current independent card approval', () => {
  const report = readyReport()
  report.coverage.publishedCurrentCardReviewPercent = 98
  const result = assessCanonicalOperationalReadiness(report)
  assert.ok(result.humanGates.some((item) => item.code === 'PUBLISHED_CARD_REVIEW_UNVERIFIED'))
})

test('operational readiness can require a valid coach facility rollout only for final enablement', () => {
  const report = readyReport()
  report.rollout = { status: 'not_enrolled', issues: [] }
  assert.equal(assessCanonicalOperationalReadiness(report).status, 'ready')
  const result = assessCanonicalOperationalReadiness(report, { requireCoachOptIn: true })
  assert.equal(result.status, 'blocked')
  assert.ok(result.failures.some((item) => item.code === 'FACILITY_ROLLOUT_NOT_READY'))
})

test('reference card has machine-checkable athlete accessibility support but still requires comprehension testing', () => {
  const result = validateAthleteSupportAccessibility(PRODUCTION_REFERENCE_CARD_DRAFT)
  assert.equal(result.status, 'passed')
  assert.equal(result.requiresHumanComprehensionTest, true)
})
