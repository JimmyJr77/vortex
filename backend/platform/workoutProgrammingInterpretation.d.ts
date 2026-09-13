import type { CoachWorkoutRequest, NormalizedCoachWorkoutRequest, ProgrammingPriority } from './workoutProgrammingRequest.js'
import type { SessionComponentKey } from './sessionComponentContract.js'
import type { ProgrammingModificationPlan } from './workoutProgrammingModification.js'
import type { WorkoutProgrammingChoices } from './workoutProgrammingChoices.js'
import type { LibraryReadPool } from './workoutProgrammingLibrarians.js'
import type { ProgrammingStaffRegistry, ProgrammingStaffRunOptions, ProgrammingStaffTrace } from './programmingStaffRuntime.js'

export type ProgrammingInterpretationOperation = Readonly<{ instructionQuote: string } & (
  | { kind: 'age_range'; cohortKey: string; ageMin: number; ageMax: number }
  | { kind: 'group_size'; cohortKey: string; athleteCount: number }
  | { kind: 'training_experience'; cohortKey: string; trainingExperience: 'beginner' | 'intermediate' | 'advanced' }
  | { kind: 'session_time'; athleticMinutes: number; tumblingMinutes: number }
  | { kind: 'logistics'; field: 'coachCount' | 'laneCount' | 'stationCount'; value: number }
  | { kind: 'component_budget'; componentKey: SessionComponentKey; budgetSeconds: number | null }
  | { kind: 'equipment_availability'; equipmentKey: string; available: boolean; quantity: number | null }
  | { kind: 'component_equipment'; componentKey: SessionComponentKey; allowed: readonly string[] }
  | ({ kind: 'priority'; componentKey: SessionComponentKey | null } & Required<ProgrammingPriority>)
  | { kind: 'regenerate_components'; componentKeys: readonly SessionComponentKey[] }
  | { kind: 'exclude_exercise'; exerciseCardId: string }
  | { kind: 'replace_exercise'; blockId: string; deliveryProfileId: string }
  | { kind: 'block_method'; blockId: string; programmingMethodId: string }
  | { kind: 'block_dose'; blockId: string; field: 'sets' | 'reps' | 'workSeconds' | 'restSeconds'; value: number | null }
)>
export interface ProgrammingControlInterpretation {
  readonly requestRevision: string; readonly summary: string; readonly questions: readonly string[]; readonly operations: readonly ProgrammingInterpretationOperation[]
}
export interface ProgrammingControlChange { readonly path: string; readonly label: string; readonly before: unknown; readonly after: unknown }
export interface ProgrammingInterpretationInput { readonly request: CoachWorkoutRequest; readonly instruction: string }
export type ProgrammingInterpretationTaxonomy = Readonly<Record<string, readonly { readonly key: string; readonly name: string }[]>>
export interface ProgrammingInterpretationResult {
  readonly schemaVersion: '1.0.0'; readonly baseRequestHash: string; readonly instruction: string
  readonly sourceWorkoutId: string; readonly sourceRevision: string; readonly sourceContentHash: string; readonly sourceTaxonomyHash: string
  readonly status: 'READY_FOR_REVIEW' | 'NEEDS_COACH_INPUT'; readonly summary: string; readonly questions: readonly string[]
  readonly proposedRequest: NormalizedCoachWorkoutRequest | null; readonly changes: readonly ProgrammingControlChange[]
  readonly operations?: readonly ProgrammingInterpretationOperation[]; readonly proposalHash?: string
  readonly reviewReferences?: { readonly exercises: readonly Pick<WorkoutProgrammingChoices['components'][number]['exercises'][number], 'ref' | 'name' | 'purpose'>[];
    readonly methods: readonly Pick<WorkoutProgrammingChoices['components'][number]['methods'][number], 'id' | 'name'>[] }
  readonly issues: readonly { readonly code: string; readonly detail: string }[]
  readonly trace: ProgrammingStaffTrace; readonly workoutGenerated: false; readonly libraryApprovalGranted: false
}
export function normalizeProgrammingInterpretationInput(raw: unknown): { readonly request: NormalizedCoachWorkoutRequest; readonly instruction: string }
export function programmingInterpretationContract(request: NormalizedCoachWorkoutRequest, modification: ProgrammingModificationPlan,
  choices: WorkoutProgrammingChoices, instruction: string, taxonomy?: ProgrammingInterpretationTaxonomy): { readonly outputSchema: object; readonly parseOutput: (raw: unknown) => ProgrammingControlInterpretation }
export function applyProgrammingInterpretation(request: NormalizedCoachWorkoutRequest, modification: ProgrammingModificationPlan, choices: WorkoutProgrammingChoices,
  interpretation: ProgrammingControlInterpretation, instruction: string, taxonomy?: ProgrammingInterpretationTaxonomy): { readonly proposedRequest: NormalizedCoachWorkoutRequest; readonly changes: readonly ProgrammingControlChange[] }
export function interpretWorkoutProgrammingRevision(args: { readonly pool: LibraryReadPool; readonly context: { readonly facilityId: string | number; readonly userId: string | number };
  readonly rawInput: unknown; readonly registry: ProgrammingStaffRegistry; readonly runOptions?: ProgrammingStaffRunOptions }): Promise<ProgrammingInterpretationResult>
