import type Joi from 'joi'
import type { ComponentEquipmentPreferences, SessionComponentKey, SessionComponentPlan } from './sessionComponentContract.js'
import type { CanonicalExerciseReference } from './workoutProgrammingLibrarians.js'

export type ProgrammingAutonomyMode = 'generate_for_me' | 'guided' | 'coach_directed' | 'modify_existing'
export type ProgrammingEvidenceKind = 'skill_progress' | 'assessment_result' | 'gymnastics_evaluation' | 'wellness_checkin' | 'session' | 'completion_log'
export interface ProgrammingEvidenceReference {
  readonly kind: ProgrammingEvidenceKind
  readonly id: string
  readonly memberId: string
  readonly expectedSourceHash?: string
}
export const PROGRAMMING_EVIDENCE_KINDS: readonly ProgrammingEvidenceKind[]
export type ProgrammingPriorityFacet = 'tenet' | 'methodology' | 'training_family' | 'athletic_niche' | 'force_velocity'
  | 'movement_character' | 'programming_set_structure' | 'programming_clock_structure' | 'conditioning_protocol' | 'physiology_mechanism'
export interface ProgrammingPriority {
  readonly facet: ProgrammingPriorityFacet
  readonly value: string
  readonly strength: 'required' | 'preferred' | 'exclude'
  readonly weight?: number
}
export interface ProgrammingAthleteCohort {
  readonly key: string
  readonly athleteCount: number
  readonly ageMin: number
  readonly ageMax: number
  readonly trainingExperience: 'beginner' | 'intermediate' | 'advanced'
  readonly trainingAgeMonths?: number | null
  readonly sportIds?: readonly string[]
  readonly maturityNotes?: string | null
  readonly limitations?: readonly string[]
  /** Complete roster or empty for anonymous cohort planning. */
  readonly memberIds?: readonly string[]
  readonly evidenceReferences?: readonly ProgrammingEvidenceReference[]
  /** @deprecated Untyped IDs require explicit migration to evidenceReferences; never inferred. */
  readonly competencyEvidenceIds?: readonly string[]
  /** @deprecated These UUIDs are not performed coaching-session IDs. */
  readonly recentSessionIds?: readonly string[]
  readonly readiness?: { readonly observedAt: string; readonly notes: string; readonly sourceRecordIds?: readonly string[] } | null
}
export interface ProgrammingComponentControls {
  readonly key: SessionComponentKey
  readonly selection?: 'auto' | 'directed'
  /** null allows deterministic allocation; zero only omits Capacity / Competition. */
  readonly budgetSeconds?: number | null
  readonly priorities?: readonly ProgrammingPriority[]
  readonly equipment?: ComponentEquipmentPreferences
  readonly preferredProgrammingMethodIds?: readonly string[]
  readonly excludedProgrammingMethodIds?: readonly string[]
  readonly preferredExercises?: readonly CanonicalExerciseReference[]
  readonly excludedExerciseCardIds?: readonly string[]
  readonly lockedProgrammingMethodIds?: readonly string[]
  readonly lockedExercises?: readonly CanonicalExerciseReference[]
  readonly lockedBlocks?: readonly { readonly blockId: string; readonly fields: readonly ('method' | 'exercises' | 'dose' | 'timing')[] }[]
}
export interface CoachWorkoutRequest {
  readonly schemaVersion?: '1.0.0'
  readonly requestId: string
  readonly revision: string
  readonly mode: ProgrammingAutonomyMode
  readonly instruction?: string
  readonly athletes: readonly ProgrammingAthleteCohort[]
  readonly logistics: {
    readonly sessionDate?: string | null
    /** ISO instant with offset; normalized to UTC and its UTC session date. */
    readonly sessionStartsAt?: string | null
    readonly athleticMinutes: number
    readonly tumblingMinutes?: number
    readonly totalBookedMinutes: number
    readonly coachCount: number
    readonly laneCount: number
    readonly stationCount: number
    readonly timerAvailable?: boolean | null
    readonly scoreTrackingAvailable?: boolean | null
    readonly clearRunoutConfirmed?: boolean | null
    readonly space?: { readonly environment?: 'indoor' | 'outdoor'; readonly floorAreaSquareFeet?: number | null; readonly laneLengthFeet?: number | null }
  }
  readonly equipment: { readonly available: readonly string[]; readonly quantities?: Readonly<Record<string, number | null>>;
    readonly preferred?: readonly string[]; readonly excluded?: readonly string[]; readonly required?: readonly string[] }
  readonly objective?: string
  readonly priorities?: readonly ProgrammingPriority[]
  readonly components?: readonly ProgrammingComponentControls[]
  readonly preferredProgrammingMethodIds?: readonly string[]
  readonly excludedProgrammingMethodIds?: readonly string[]
  readonly preferredExercises?: readonly CanonicalExerciseReference[]
  readonly excludedExerciseCardIds?: readonly string[]
  readonly consultants?: readonly string[]
  readonly modification?: { readonly workoutId: string; readonly expectedRevision: string } | null
  readonly randomSeed?: string
}
export interface NormalizedProgrammingComponent extends Required<Omit<ProgrammingComponentControls, 'priorities'>> {
  readonly priorities: readonly Required<ProgrammingPriority>[]
}
export interface NormalizedProgrammingAthleteCohort extends Required<Omit<ProgrammingAthleteCohort, 'readiness'>> {
  readonly readiness: { readonly observedAt: string; readonly notes: string; readonly sourceRecordIds: readonly string[] } | null
}
export interface NormalizedCoachWorkoutRequest extends Required<Omit<CoachWorkoutRequest, 'athletes' | 'logistics' | 'equipment' | 'components' | 'priorities'>> {
  readonly athletes: readonly NormalizedProgrammingAthleteCohort[]
  readonly logistics: Required<Omit<CoachWorkoutRequest['logistics'], 'space'>> & { readonly space: Required<NonNullable<CoachWorkoutRequest['logistics']['space']>> }
  readonly equipment: Required<CoachWorkoutRequest['equipment']>
  readonly components: readonly NormalizedProgrammingComponent[]
  readonly priorities: readonly Required<ProgrammingPriority>[]
  readonly assumptions: readonly string[]
}
export const PROGRAMMING_REQUEST_VERSION: '1.0.0'
export const PROGRAMMING_AUTONOMY_MODES: readonly ProgrammingAutonomyMode[]
export const CANONICAL_UUID_SCHEMA: Joi.StringSchema
export const EXERCISE_REFERENCE_SCHEMA: Joi.ObjectSchema<CanonicalExerciseReference>
export const PRIORITY_SCHEMA: Joi.ObjectSchema<Required<ProgrammingPriority>>
export function immutableProgrammingValue<T>(value: T): Readonly<T>
export function programmingValueHash(value: unknown): string
export function parseProgrammingContract<T>(schema: Joi.Schema<T>, raw: unknown, label: string): T
export function normalizeCoachWorkoutRequest(raw: unknown): NormalizedCoachWorkoutRequest
export function allocateProgrammingComponentBudgets(request: NormalizedCoachWorkoutRequest): Readonly<Partial<Record<SessionComponentKey, number>>>
export function programmingComponentPlan(request: NormalizedCoachWorkoutRequest): SessionComponentPlan
/** Existing canonical intent; this projection cannot establish session coverage or final eligibility. */
export function canonicalIntentForProgrammingComponent(request: NormalizedCoachWorkoutRequest, componentKey: SessionComponentKey): Readonly<Record<string, unknown>>
