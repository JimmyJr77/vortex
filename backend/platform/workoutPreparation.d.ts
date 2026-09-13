import type { NormalizedCoachWorkoutRequest } from './workoutProgrammingRequest.js'
import type { CanonicalProgrammingActivity, CanonicalProgrammingDose, CanonicalSchedulingCard, CanonicalSchedulingProfile } from './canonicalProgrammingDose.js'
import type { CanonicalExerciseReference } from './workoutProgrammingLibrarians.js'
import type { SessionComponentKey } from './sessionComponentContract.js'
import type { VortexPreparationPurpose } from '../shared/vortexPreparationFramework.js'

export interface ProgrammingPreparationDemand {
  readonly frameworkVersion: '1.0.0'
  readonly frameworkHash: string
  readonly downstreamHash: string
  readonly exposures: readonly { readonly demandId: string; readonly componentKey: SessionComponentKey; readonly ref: CanonicalExerciseReference;
    readonly exerciseName: string; readonly familyId: string; readonly movementPatterns: readonly string[];
    readonly anatomyProfile: Readonly<Record<string, unknown>>; readonly movementGeometry: Readonly<Record<string, unknown>>;
    readonly taskDemands: Readonly<Record<string, unknown>>; readonly stressProfile: Readonly<Record<string, unknown>>;
    readonly taxonomy: readonly Readonly<Record<string, unknown>>[]; readonly dose: CanonicalProgrammingDose; readonly doseHash: string }[]
  readonly signature: Readonly<Record<string, readonly string[]>>
}
export interface ProgrammingPreparationProposal {
  readonly requestRevision: string
  readonly downstreamHash: string
  readonly summary: string
  readonly selections: readonly { readonly deliveryProfileId: string; readonly programmingMethodId: string;
    readonly role: 'base' | 'position_rehearsal' | 'progressive_bridge'; readonly purposes: readonly VortexPreparationPurpose[];
    readonly addressesDemandIds: readonly string[]; readonly rationale: string }[]
  readonly watchPoints: readonly string[]
}
export function deriveProgrammingPreparationDemand(activities: readonly CanonicalProgrammingActivity[]): ProgrammingPreparationDemand
export function preparationCapabilityContract(args: { readonly request: NormalizedCoachWorkoutRequest; readonly demand: ProgrammingPreparationDemand;
  readonly candidates: readonly { readonly card: CanonicalSchedulingCard; readonly profile: CanonicalSchedulingProfile; readonly methodIds: readonly string[] }[]
}): { readonly outputSchema: object; readonly parseOutput: (raw: unknown) => ProgrammingPreparationProposal }
export const VORTEX_PREPARATION_CAPABILITY_CONTEXT: { readonly frameworkVersion: '1.0.0'; readonly frameworkHash: string;
  readonly purposes: readonly VortexPreparationPurpose[]; readonly guidance: typeof import('../shared/vortexPreparationFramework.js').VORTEX_PREPARATION_SECTION }
