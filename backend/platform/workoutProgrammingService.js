import { generateWorkoutProgramming } from './workoutProgrammingWorkflow.js'
import { persistWorkoutProgrammingRun } from './workoutProgrammingRepository.js'

/** Application entry point: one bounded staff lifecycle followed by an atomic validated snapshot save. */
export async function generateAndPersistWorkoutProgramming(args) {
  const workflow = await generateWorkoutProgramming(args)
  return persistWorkoutProgrammingRun({ pool: args.pool, context: args.context, workflow, signal: args.runOptions?.signal })
}
