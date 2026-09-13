export const CANONICAL_PROGRAMMING_RULES_VERSION: '1.0.0'
export type CanonicalProgrammingRuleField = 'prerequisites' | 'sequenceRules' | 'pairingCompatibility' | 'weeklyExposure' | 'interferenceRules' | 'uncertaintyPolicy'
export const CANONICAL_PROGRAMMING_RULE_FIELDS: readonly CanonicalProgrammingRuleField[]
export interface CanonicalRuleTarget {
  readonly targetType: 'variant' | 'definition' | 'family' | 'movement_pattern' | 'body_region' | 'taxonomy'
  readonly targetKey: string
  readonly facetType?: string | null
}
interface ObservationBase {
  readonly id: string; readonly type: 'athlete_observation'
  readonly prerequisite?: string | null; readonly purpose: 'competency' | 'current_readiness'
  readonly providesFact?: 'deceleration_ready' | null
  readonly operator: 'gte' | 'lte' | 'eq'; readonly value: number | string
  readonly scaleMaximum?: number | null; readonly unit?: string | null
  readonly maxAgeDays: number; readonly requireCoachObservation: boolean
}
export type CanonicalObservationRule = ObservationBase & (
  { readonly sourceKind: 'skill_progress'; readonly field: 'score'; readonly selector: { readonly exerciseId?: string; readonly criterionId?: string; readonly skillLabel?: string } }
  | { readonly sourceKind: 'assessment_result'; readonly field: 'value' | 'textValue'; readonly selector: { readonly assessmentId: string } }
  | { readonly sourceKind: 'gymnastics_evaluation'; readonly field: 'score'; readonly selector: { readonly movementKey: string; readonly componentKey: string; readonly variant?: string | null } }
  | { readonly sourceKind: 'wellness_checkin'; readonly field: 'sleepHours' | 'soreness' | 'rpe' | 'mood' | 'energy'; readonly selector: Readonly<Record<string, never>> }
)
export interface CanonicalSequenceRule {
  readonly id: string; readonly type: 'sequence'
  /** requires_before requires the matching target earlier; prefers_* describes the subject's position relative to the target. */
  readonly relation: 'requires_before' | 'avoid_after' | 'avoid_same_session' | 'prefers_before' | 'prefers_after'
  readonly target: CanonicalRuleTarget
}
export interface CanonicalInterferenceRule {
  readonly id: string; readonly type: 'dose_limit_after'; readonly target: CanonicalRuleTarget
  readonly maximumSets?: number; readonly maximumActiveSeconds?: number; readonly maximumHighImpactContacts?: number
}
export interface CanonicalExposureRule {
  readonly id: string; readonly type: 'recorded_exposure'; readonly legacyExerciseIds: readonly string[]
  readonly windowDays: number; readonly maximumSessions: number; readonly minimumRecoveryHours: number
  readonly historyScope: 'recorded_facility'; readonly eventTime: 'completion_logged_at'
}
export type CanonicalProgrammingExecutionRule = CanonicalObservationRule | CanonicalSequenceRule | CanonicalInterferenceRule | CanonicalExposureRule
export interface CanonicalProgrammingExecutionRules {
  readonly schemaVersion: '1.0.0'
  readonly bindings: readonly { readonly field: CanonicalProgrammingRuleField; readonly sourceHash: string; readonly ruleIds: readonly string[]; readonly interpretation: string }[]
  readonly rules: readonly CanonicalProgrammingExecutionRule[]
}
export function canonicalProgrammingRuleSourceHash(programming: Readonly<Record<string, unknown>>, field: CanonicalProgrammingRuleField): string
export function parseCanonicalProgrammingExecutionRules(programming: Readonly<Record<string, unknown>>,
  options?: { readonly requireComplete?: boolean }): CanonicalProgrammingExecutionRules | null
