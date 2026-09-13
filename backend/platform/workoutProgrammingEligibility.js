import { evaluateCanonicalProgrammingEligibility } from './canonicalProgrammingRules.js'
import { immutableProgrammingValue } from './workoutProgrammingRequest.js'

/** Run before the model context cutoff. A review gap is not proof that an exercise is unsuitable. */
export function filterProgrammingCandidateEligibility({ groups, request, athleteEvidence }) {
  const reports = []
  const filtered = groups.map((group) => ({ ...group, candidates: group.candidates.filter((candidate) => {
    const result = evaluateCanonicalProgrammingEligibility({ card: candidate.card, componentKey: group.key, request, athleteEvidence })
    const knownViolation = result.findings.some((entry) => entry.code === 'exercise_execution_rule' && entry.status === 'VIOLATED')
    reports.push({ componentKey: group.key, deliveryProfileId: candidate.profile.id, variantId: candidate.card.variantId,
      status: result.status === 'PASS' ? 'ELIGIBLE' : knownViolation ? 'INELIGIBLE' : 'REQUIRES_REVIEW', result })
    return result.status === 'PASS'
  }) }))
  return immutableProgrammingValue({ groups: filtered, reports })
}
