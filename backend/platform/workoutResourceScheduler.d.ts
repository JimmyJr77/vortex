import type { CanonicalProgrammingActivity, CanonicalProgrammingDose, CanonicalActivityOverhead } from './canonicalProgrammingDose.js'
import type { NormalizedCoachWorkoutRequest } from './workoutProgrammingRequest.js'
import type { SessionComponentKey, SessionComponentPlan } from './sessionComponentContract.js'

export const RESOURCE_SCHEDULER_VERSION: '1.0.0'
export interface CanonicalActivitySchedule {
  readonly schemaVersion: '1.0.0'
  readonly activityId: string
  readonly componentKey: SessionComponentKey
  readonly startSeconds: number
  readonly endSeconds: number
  readonly elapsedSeconds: number
  readonly recoveryCompleteSeconds: number
  readonly participantCount: number
  readonly stationCount: number
  readonly athletesPerStation: number
  readonly waveCount: number
  readonly requiredEquipment: readonly string[]
  readonly quantitiesPerStation: Readonly<Record<string, number>>
  readonly requiresLanes: boolean
  readonly areaPerStation: number
  readonly timing: CanonicalActivityOverhead
  readonly timingAssumptions: readonly string[]
  readonly needsCoachTimingConfirmation: boolean
  readonly workSecondsPerAthlete: number
  readonly restSecondsPerAthleteBetweenSets: number
  readonly events: readonly { readonly set: number; readonly wave: number; readonly startSeconds: number; readonly endSeconds: number;
    readonly resourceReleaseSeconds: number; readonly athleteKeys: readonly string[]; readonly equipmentUse: Readonly<Record<string, number>>;
    readonly stationAssignments: readonly { readonly station: number; readonly lane: number | null; readonly athleteKeys: readonly string[] }[] }[]
  readonly doseHash: string
}
export interface ResourceScheduleValidation {
  readonly status: 'PASS' | 'REVISE'
  readonly issues: readonly { readonly code: string; readonly activityId?: string; readonly athleteKey?: string; readonly equipmentKey?: string; readonly second?: number }[]
}
export interface ProgrammingSessionSchedule {
  readonly schemaVersion: '1.0.0'
  readonly components: readonly { readonly key: SessionComponentKey; readonly startSeconds: number; readonly endSeconds: number;
    readonly reserveSeconds: number; readonly activities: readonly CanonicalActivitySchedule[] }[]
  readonly bookedSeconds: number
  readonly sessionReserveSeconds: number
  readonly resourceValidation: ResourceScheduleValidation
  readonly status: 'SCHEDULED' | 'NEEDS_COMPOSITION'
  readonly validatedWorkout: false
}
export function scheduleCanonicalExercise(args: CanonicalProgrammingActivity & { readonly request: NormalizedCoachWorkoutRequest;
  readonly component: SessionComponentPlan['components'][number]; readonly startSeconds?: number }): CanonicalActivitySchedule
/** Checks event integrity and shared resources. Final QA must also rehydrate source cards and methods. */
export function validateWorkoutResourceSchedule(activities: readonly { readonly schedule: CanonicalActivitySchedule; readonly dose: CanonicalProgrammingDose }[], request: NormalizedCoachWorkoutRequest): ResourceScheduleValidation
export function scheduleProgrammingSession(args: { readonly request: NormalizedCoachWorkoutRequest; readonly componentPlan: SessionComponentPlan;
  readonly components: readonly { readonly key: SessionComponentKey; readonly activities: readonly CanonicalProgrammingActivity[] }[] }): ProgrammingSessionSchedule
