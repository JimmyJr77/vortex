import test from 'node:test'
import assert from 'node:assert/strict'

import {
  assessCanonicalOperationalReadiness,
  validateAthleteSupportAccessibility,
} from '../canonicalOperationalReadiness.js'
import { PRODUCTION_REFERENCE_CARD_DRAFT } from '../canonicalReferenceCard.js'

function readyReport() {
  return {
    coverage: { publishedDefinitions: 50 },
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

test('reference card has machine-checkable athlete accessibility support but still requires comprehension testing', () => {
  const result = validateAthleteSupportAccessibility(PRODUCTION_REFERENCE_CARD_DRAFT)
  assert.equal(result.status, 'passed')
  assert.equal(result.requiresHumanComprehensionTest, true)
})
