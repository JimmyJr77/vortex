import type { ProgrammingCandidateGroup } from './workoutProgrammingBuilder.js'
import type { CanonicalProgrammingRuleResult } from './canonicalProgrammingRules.js'
import type { NormalizedCoachWorkoutRequest } from './workoutProgrammingRequest.js'
import type { ProgrammingAthleteEvidence } from './workoutAthleteEvidence.js'
export interface ProgrammingCandidateEligibilityReport {
  readonly componentKey: ProgrammingCandidateGroup['key']; readonly deliveryProfileId: string; readonly variantId: string
  readonly status: 'ELIGIBLE' | 'INELIGIBLE' | 'REQUIRES_REVIEW'; readonly result: CanonicalProgrammingRuleResult
}
export function filterProgrammingCandidateEligibility(args: { readonly groups: readonly ProgrammingCandidateGroup[];
  readonly request: NormalizedCoachWorkoutRequest; readonly athleteEvidence: ProgrammingAthleteEvidence }): {
  readonly groups: readonly ProgrammingCandidateGroup[]; readonly reports: readonly ProgrammingCandidateEligibilityReport[]
}
