import type { NormalizedCoachWorkoutRequest } from './workoutProgrammingRequest.js'
import type { DeliveryPhaseKey } from './workoutProgrammingLibrarians.js'
import type { SessionComponentKey } from './sessionComponentContract.js'

export class ProgrammingPrescriptionError extends Error {
  readonly code: string
  readonly details: Readonly<Record<string, unknown>>
  constructor(code: string, message: string, details?: Readonly<Record<string, unknown>>)
}
export interface CanonicalSchedulingProfile {
  readonly id: string
  readonly phaseKey: DeliveryPhaseKey
  readonly dosage: Readonly<Record<string, unknown>>
  readonly logistics?: Partial<CanonicalActivityOverhead> & { readonly stationCapacity?: number; readonly requiresLanes?: boolean; readonly requiresClearRunout?: boolean; readonly laneLengthFeet?: number }
  readonly timeModel?: Partial<CanonicalActivityOverhead>
  readonly setupSeconds?: number
  readonly demonstrationSeconds?: number
  readonly transitionSeconds?: number
  readonly resetSeconds?: number
  readonly cleanupSeconds?: number
  readonly qualityGate: string
  readonly stopRules: readonly string[]
  readonly equipmentRequired?: readonly string[]
}
export interface CanonicalActivityOverhead {
  readonly setupSeconds: number
  readonly demonstrationSeconds: number
  readonly transitionSeconds: number
  readonly resetSeconds: number
  readonly cleanupSeconds: number
}
export interface CanonicalSchedulingCard {
  readonly id: string
  readonly variantId: string
  readonly familyId: string
  readonly deliveryProfiles: readonly CanonicalSchedulingProfile[]
  readonly environment: { readonly stationCapacity?: number; readonly floorAreaSquareFeet?: number; readonly laneLengthFeet?: number }
  readonly difficulty: { readonly technicalComplexity: number }
  readonly taskDemands: { readonly supervisionDemand: number; readonly failureConsequence: number; readonly impactToleranceDemand: number }
  readonly equipmentRoles?: readonly { readonly key: string; readonly role: string; readonly quantityPerStation?: number }[]
  readonly equipment?: { readonly required?: readonly string[]; readonly quantityPerStation?: Readonly<Record<string, number>> }
  readonly loadProfile?: Readonly<Record<string, unknown>>
  readonly fatigueProfile?: Readonly<Record<string, number | null>>
  readonly stressProfile: Readonly<Record<string, unknown>>
  readonly compositionProfile?: Readonly<Record<string, unknown>>
}
export interface CanonicalSchedulingMethod {
  readonly id: string
  readonly best_session_phase: DeliveryPhaseKey
  readonly compatible_session_phases?: readonly DeliveryPhaseKey[]
  readonly incompatible_phases?: readonly DeliveryPhaseKey[]
  readonly phase_profiles?: readonly { readonly phaseKey: DeliveryPhaseKey; readonly role: string }[]
  readonly fatigue_profile?: { readonly fatigue_level?: string; readonly technical_risk_under_fatigue?: string }
  readonly workout_builder_rules?: { readonly requires_lanes?: boolean; readonly requires_clear_runout?: boolean }
  readonly prescriptions: readonly { readonly id: string; readonly age_min?: number | null; readonly age_max?: number | null;
    readonly training_experience?: string | null; readonly default_rounds?: number | null; readonly default_work_seconds?: number | null;
    readonly default_rest_seconds?: number | null; readonly default_rest_between_rounds_seconds?: number | null }[]
  readonly stop_rules?: readonly { readonly stopRule: string }[]
}
export interface ProgrammingDoseProposal { readonly sets?: number; readonly reps?: number | null; readonly workSeconds?: number; readonly restSeconds?: number }
export interface DoseRange { readonly target: number; readonly min: number; readonly max: number }
export interface CanonicalContactExposure {
  readonly contacts: number | null
  readonly contactsPerSet: number | null
  readonly source: 'profile_contacts_per_set' | 'profile_contact_estimate' | 'variant_contact_estimate' | 'variant_contacts_per_rep' | 'unknown'
}
export interface CanonicalProgrammingDose {
  readonly schemaVersion: '1.0.0'
  readonly programmingMethodId: string
  readonly methodPrescriptionId: string
  readonly sets: number
  readonly reps: number | null
  readonly workSeconds: number
  readonly restSeconds: number
  readonly restBetweenRoundsSeconds: number
  readonly activeSecondsPerAthlete: number
  readonly contacts: number | null
  readonly contactExposure: CanonicalContactExposure
  readonly highImpactContacts: number
  readonly tempo: unknown
  readonly rpe: unknown
  readonly loadMethod: unknown
  readonly loadTarget: unknown
  readonly bounds: { readonly sets: DoseRange; readonly reps: DoseRange | null; readonly workSeconds: DoseRange; readonly restSeconds: DoseRange }
  readonly qualityGate: string
  readonly stopRules: readonly string[]
}
export interface CanonicalProgrammingActivity {
  readonly activityId: string
  readonly componentKey: SessionComponentKey
  readonly card: CanonicalSchedulingCard
  readonly profile: CanonicalSchedulingProfile
  readonly method: CanonicalSchedulingMethod
  readonly dose: CanonicalProgrammingDose
}
export function prescriptionInteger(value: unknown, field: string, min?: number, max?: number): number
export function canonicalContactExposure(card: CanonicalSchedulingCard, profile: CanonicalSchedulingProfile, sets: number, reps: number | null): CanonicalContactExposure
export function resolveCanonicalProgrammingDose(args: { readonly card: CanonicalSchedulingCard; readonly profile: CanonicalSchedulingProfile;
  readonly method: CanonicalSchedulingMethod; readonly request: NormalizedCoachWorkoutRequest; readonly componentKey: SessionComponentKey;
  readonly proposal?: ProgrammingDoseProposal }): CanonicalProgrammingDose
