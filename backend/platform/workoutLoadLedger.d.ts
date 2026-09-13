import type { NormalizedCoachWorkoutRequest } from './workoutProgrammingRequest.js'
import type { CanonicalProgrammingActivity } from './canonicalProgrammingDose.js'
import type { SessionComponentKey } from './sessionComponentContract.js'

export const PROGRAMMING_LOAD_LEDGER_VERSION: '1.0.0'
export const LOAD_REFERENCE_ACTIVE_MINUTES: 60
export interface ProgrammingLoadState { readonly fatigue: Readonly<Record<string, number>>; readonly stress: Readonly<Record<string, number>>; readonly highImpactContacts: number }
export interface ProgrammingLoadLedger {
  readonly schemaVersion: '1.0.0'
  readonly referenceActiveMinutes: 60
  readonly interpretation: 'reviewed_score_exposure_index'
  readonly status: 'PASS' | 'REVISE'
  readonly issues: readonly { readonly code: string; readonly activityId: string; readonly fields?: readonly string[]; readonly field?: string;
    readonly actual?: number; readonly cap?: number; readonly reason?: string }[]
  readonly entries: readonly { readonly activityId: string; readonly componentKey: SessionComponentKey; readonly doseHash: string;
    readonly activeSecondsPerAthlete: number; readonly fatigueCost: Readonly<Record<string, number>>; readonly stressCost: Readonly<Record<string, number>>;
    readonly highImpactContacts: number; readonly before: ProgrammingLoadState; readonly after: ProgrammingLoadState; readonly remaining: ProgrammingLoadState }[]
  readonly totals: ProgrammingLoadState
  readonly budgets: ProgrammingLoadState
  readonly validatedWorkout: false
}
/** Load indices require coach calibration; they are not measured physiological fatigue. */
export function evaluateProgrammingLoadSequence(args: { readonly request: NormalizedCoachWorkoutRequest; readonly activities: readonly CanonicalProgrammingActivity[] }): ProgrammingLoadLedger
