import type { CanonicalProgrammingActivity } from './canonicalProgrammingDose.js'
import type { NormalizedCoachWorkoutRequest } from './workoutProgrammingRequest.js'
import type { ProgrammingAthleteEvidence } from './workoutAthleteEvidence.js'
import type { CanonicalProgrammingExecutionRules, CanonicalProgrammingExecutionRule } from './canonicalProgrammingRulesContract.js'
export const CANONICAL_PROGRAMMING_RULE_EVALUATOR_VERSION: '1.0.0'
export type CanonicalExecutionRuleStatus = 'SATISFIED' | 'VIOLATED' | 'UNKNOWN' | 'ADVISORY' | 'NOT_APPLICABLE' | 'DEFERRED'
export interface CanonicalExecutionRuleOutcome extends Readonly<Record<string, unknown>> {
  readonly status: CanonicalExecutionRuleStatus
  readonly code?: string
}
export interface CanonicalProgrammingRuleResult {
  readonly schemaVersion: '1.0.0'; readonly activityId: string; readonly status: 'PASS' | 'REVISE'
  readonly findings: readonly { readonly code: string; readonly message: string;
    readonly route: 'exercise_librarian' | 'athlete_development' | 'session_builder'; readonly ruleId?: string;
    readonly status?: CanonicalExecutionRuleStatus; readonly outcomes?: readonly CanonicalExecutionRuleOutcome[] }[]
  readonly evaluations: readonly { readonly ruleId: string; readonly type: CanonicalProgrammingExecutionRule['type'];
    readonly status: CanonicalExecutionRuleStatus; readonly outcomes: readonly CanonicalExecutionRuleOutcome[] }[]
  readonly contract: CanonicalProgrammingExecutionRules | null
  readonly facts: { readonly decelerationReady: boolean | null }
}
export function evaluateCanonicalProgrammingRules(args: { readonly activity: CanonicalProgrammingActivity;
  readonly activities: readonly CanonicalProgrammingActivity[]; readonly request: NormalizedCoachWorkoutRequest;
  readonly athleteEvidence: ProgrammingAthleteEvidence }): CanonicalProgrammingRuleResult
export function evaluateCanonicalProgrammingEligibility(args: Pick<CanonicalProgrammingActivity, 'card' | 'componentKey'> & {
  readonly request: NormalizedCoachWorkoutRequest; readonly athleteEvidence: ProgrammingAthleteEvidence }): CanonicalProgrammingRuleResult
