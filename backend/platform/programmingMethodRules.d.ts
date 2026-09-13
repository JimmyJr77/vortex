import type { CanonicalProgrammingActivity } from './canonicalProgrammingDose.js'
import type { NormalizedCoachWorkoutRequest } from './workoutProgrammingRequest.js'
import type { CanonicalActivitySchedule } from './workoutResourceScheduler.js'
export const PROGRAMMING_METHOD_RULES_VERSION: '1.0.0'
export interface ProgrammingMethodFacts {
  readonly capMinutes?: number | null
  readonly qualityStandardsCount?: number | null
  readonly laterPhaseKeys?: readonly string[] | null
  readonly containsAdvancedSkill?: boolean | null
  readonly workSeconds?: number | null
  readonly youngestAge?: number | null
  readonly fatigueLevel?: string | null
  readonly requiresClearRunout?: boolean | null
  readonly runoutPresent?: boolean | null
  readonly decelerationReady?: boolean | null
}
export interface ProgrammingMethodConditionResult {
  readonly status: 'TRIGGERED' | 'NOT_TRIGGERED' | 'UNKNOWN'
  readonly predicates: readonly { readonly key: string; readonly expected: unknown; readonly met: boolean | null }[]
}
export interface ProgrammingMethodRuleFinding {
  readonly code: string; readonly message: string; readonly severity: string
  readonly field?: string; readonly actual?: unknown; readonly exerciseType?: string
  readonly recommendedAction?: string | null; readonly ruleKey?: string
}
export interface ProgrammingMethodRuleResult {
  readonly schemaVersion: '1.0.0'; readonly activityId: string; readonly status: 'PASS' | 'REVISE'
  readonly findings: readonly ProgrammingMethodRuleFinding[]
  readonly evaluations: readonly (ProgrammingMethodConditionResult & { readonly ruleKey: string; readonly severity: string })[]
  readonly facts: ProgrammingMethodFacts
  readonly qualityStandards: readonly { readonly standard: string; readonly severity?: string; readonly appliesToExerciseType?: string | null }[]
  readonly coachingGuidance: { readonly groupFriendly: boolean | null; readonly complexity: string | null; readonly safetyNotes: readonly string[];
    readonly workRestOptions: readonly string[]; readonly pacingNotes: string | null }
}
export function evaluateProgrammingMethodCondition(condition: unknown, facts: ProgrammingMethodFacts): ProgrammingMethodConditionResult
export function evaluateProgrammingMethodRules(args: { readonly activity: CanonicalProgrammingActivity; readonly request: NormalizedCoachWorkoutRequest;
  readonly activities: readonly CanonicalProgrammingActivity[]; readonly schedule?: CanonicalActivitySchedule | null;
  readonly readinessFacts?: { readonly decelerationReady?: boolean | null } }): ProgrammingMethodRuleResult
