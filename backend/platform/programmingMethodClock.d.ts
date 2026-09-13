import type { CanonicalSchedulingMethod, CanonicalMethodPrescription } from './canonicalProgrammingDose.js'
import type { NormalizedCoachWorkoutRequest } from './workoutProgrammingRequest.js'
export const PROGRAMMING_CLOCK_VERSION: '1.0.0'
export interface ProgrammingMethodPrescriptionSelection {
  readonly profile: CanonicalMethodPrescription
  readonly audience: { readonly experience: string | null; readonly source: 'training_experience' | 'profile_name' | 'unrestricted' }
  readonly groupExperience: string
}
export interface ProgrammingMethodClock {
  readonly schemaVersion: '1.0.0'
  readonly kind: 'recovery_sets' | 'fixed_interval' | 'minute_clock' | 'unsupported'
  readonly methodType: string | null
  readonly prescriptionId: string
  readonly audience: string | null
  readonly audienceSource: ProgrammingMethodPrescriptionSelection['audience']['source']
  readonly targetSets: number | null
  readonly recommendedSets: number | null
  readonly intervalSeconds: number | null
  readonly domainSeconds: number | null
  readonly workSeconds: number | null
  readonly restSeconds: number | null
  readonly rpeRange: readonly [number, number] | null
  readonly allowsSetReduction: boolean
  readonly staggerWaves: boolean
}
export function selectProgrammingMethodPrescription(method: CanonicalSchedulingMethod, request: NormalizedCoachWorkoutRequest): ProgrammingMethodPrescriptionSelection
export function resolveProgrammingMethodClock(method: CanonicalSchedulingMethod, selection: ProgrammingMethodPrescriptionSelection): ProgrammingMethodClock
