const DEFAULT_THRESHOLDS = Object.freeze({
  minimumPublishedDefinitions: 25,
  minimumPhaseDepth: 3,
  minimumApprovedEdges: 10,
  minimumApprovedCalibrationAnchors: 3,
  minimumCoachReviews: 20,
  minimumKeepOrMinorEditPercent: 85,
  maximumSwapPercent: 15,
  maximumDoseEditPercent: 20,
})

function issue(code, message, evidence, humanGate = false) {
  return { code, message, evidence, humanGate }
}

export function assessCanonicalOperationalReadiness(report, overrides = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...overrides }
  const failures = []
  const coverage = report?.coverage ?? {}
  const governance = report?.governance ?? {}
  const graph = report?.graph ?? {}
  const pilot = report?.coachPilot ?? {}
  const phaseDepth = report?.poolDepthByPhase ?? {}

  if (Number(coverage.publishedDefinitions ?? 0) < thresholds.minimumPublishedDefinitions) {
    failures.push(issue('INSUFFICIENT_PUBLISHED_LIBRARY', 'Published library is below the release floor.', {
      actual: Number(coverage.publishedDefinitions ?? 0),
      required: thresholds.minimumPublishedDefinitions,
    }))
  }
  const shallowPhases = Object.entries(phaseDepth)
    .filter(([, count]) => Number(count) < thresholds.minimumPhaseDepth)
    .map(([phase, count]) => ({ phase, count: Number(count) }))
  if (shallowPhases.length) {
    failures.push(issue('INSUFFICIENT_PHASE_DEPTH', 'One or more required phases lack substitution depth.', {
      shallowPhases,
      requiredPerPhase: thresholds.minimumPhaseDepth,
    }))
  }
  if (Number(graph.approvedEdges ?? 0) < thresholds.minimumApprovedEdges) {
    failures.push(issue('INSUFFICIENT_APPROVED_RELATIONSHIPS', 'Approved substitution and progression coverage is below the release floor.', {
      actual: Number(graph.approvedEdges ?? 0),
      required: thresholds.minimumApprovedEdges,
    }, true))
  }
  if (Number(governance.approvedCalibrationAnchors ?? 0) < thresholds.minimumApprovedCalibrationAnchors) {
    failures.push(issue('INSUFFICIENT_CALIBRATION', 'Difficulty scores lack enough independently approved anchors.', {
      actual: Number(governance.approvedCalibrationAnchors ?? 0),
      required: thresholds.minimumApprovedCalibrationAnchors,
    }, true))
  }
  for (const [code, field] of [
    ['BROKEN_MEDIA', 'mediaFailures'],
    ['OVERDUE_MEDIA_REVIEW', 'mediaReviewsDue'],
    ['IDENTITY_COLLISION', 'exactIdentityCollisions'],
  ]) {
    if (Number(governance[field] ?? 0) > 0) {
      failures.push(issue(code, `Governance check ${field} must be zero for release.`, {
        actual: Number(governance[field]),
      }, true))
    }
  }
  if (Number(pilot.reviewCount ?? 0) < thresholds.minimumCoachReviews) {
    failures.push(issue('COACH_PILOT_INCOMPLETE', 'A real coach pilot has not reached its minimum sample.', {
      actual: Number(pilot.reviewCount ?? 0),
      required: thresholds.minimumCoachReviews,
    }, true))
  } else {
    if (Number(pilot.keepOrMinorEditPercent ?? 0) < thresholds.minimumKeepOrMinorEditPercent) {
      failures.push(issue('COACH_ACCEPTANCE_BELOW_TARGET', 'Coach acceptance is below the release threshold.', {
        actual: Number(pilot.keepOrMinorEditPercent ?? 0),
        required: thresholds.minimumKeepOrMinorEditPercent,
      }, true))
    }
    if (Number(pilot.swapPercent ?? 100) > thresholds.maximumSwapPercent) {
      failures.push(issue('SWAP_RATE_ABOVE_TARGET', 'Coach substitution rate is above the release threshold.', {
        actual: Number(pilot.swapPercent ?? 100),
        maximum: thresholds.maximumSwapPercent,
      }, true))
    }
    if (Number(pilot.doseEditPercent ?? 100) > thresholds.maximumDoseEditPercent) {
      failures.push(issue('DOSE_EDIT_RATE_ABOVE_TARGET', 'Coach dose-edit rate is above the release threshold.', {
        actual: Number(pilot.doseEditPercent ?? 100),
        maximum: thresholds.maximumDoseEditPercent,
      }, true))
    }
  }

  return {
    status: failures.length === 0 ? 'ready' : 'blocked',
    evaluatedAt: new Date().toISOString(),
    thresholds,
    failures,
    humanGates: failures.filter((item) => item.humanGate),
  }
}

export function validateAthleteSupportAccessibility(card) {
  const support = card?.athleteSupport ?? {}
  const accessibility = support.accessibility ?? {}
  const failures = []
  if (!String(support.primaryCue ?? '').trim()) failures.push('primaryCue')
  if (!Array.isArray(support.expectedSensations) || support.expectedSensations.length === 0) failures.push('expectedSensations')
  if (!Array.isArray(support.unexpectedSensations) || support.unexpectedSensations.length === 0) failures.push('unexpectedSensations')
  if (!String(support.painGuidance ?? '').trim()) failures.push('painGuidance')
  if (!Array.isArray(support.selfChecks) || support.selfChecks.length === 0) failures.push('selfChecks')
  if (Object.keys(accessibility).length === 0) failures.push('accessibility')
  if (!support.mediaAlternatives || Object.keys(support.mediaAlternatives).length === 0) failures.push('mediaAlternatives')
  return {
    status: failures.length === 0 ? 'passed' : 'failed',
    failures,
    requiresHumanComprehensionTest: true,
  }
}

export { DEFAULT_THRESHOLDS as CANONICAL_OPERATIONAL_THRESHOLDS }
