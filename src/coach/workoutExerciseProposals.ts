export type { WorkoutExerciseDemand, WorkoutExerciseGapResearch, WorkoutExerciseGapResearchInput } from '../../backend/platform/workoutExerciseGapResearch.js'
export type { WorkoutExerciseGapAssessment } from '../../backend/platform/workoutExerciseGapAssessment.js'
export type { StagedCanonicalEvent, StagedCanonicalRevisionView, StagedCanonicalRevisionChange } from '../../backend/platform/canonicalCardStagedRevision.js'
export type { ExerciseProposalResult, ExerciseProposalReview, ExerciseProposalPage, AcceptedExerciseProposal,
  QuarantinedExerciseProfile, QuarantinedExerciseProposal } from '../../backend/platform/workoutExerciseProposal.js'

/** Legacy delivery phases retain their canonical keys; coaches see session component names. */
export const EXERCISE_DELIVERY_LABELS: Record<string, string> = {
  prepare_and_access: 'Prepare & Access', movement_intelligence: 'Movement intelligence', output: 'Explosiveness',
  capacity: 'Strength', resilience: 'Resilience', sustained_capacity: 'Capacity / Competition', restore: 'Restore',
}
