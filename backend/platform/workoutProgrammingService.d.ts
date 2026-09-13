import type { generateWorkoutProgramming } from './workoutProgrammingWorkflow.js'
import type { SavedProgrammingWorkout } from './workoutProgrammingRepository.js'
export function generateAndPersistWorkoutProgramming(args: Parameters<typeof generateWorkoutProgramming>[0]): Promise<SavedProgrammingWorkout>
