import type { AccessPrepareRoutineExercise } from '../accessPrepareStandard'

export type PreparationDiscipline = 'sprinting' | 'running' | 'lifting-upper' | 'lifting-lower' | 'lifting-full' | 'throwing' | 'jumping'
export type PreparationDuration = 15 | 10 | 5
export type PreparationExercise = Omit<AccessPrepareRoutineExercise, 'order' | 'dose'>

export type PreparationStep = {
  exercise: PreparationExercise
  dose: string
  seconds: number
  workSeconds: number
  recoverySeconds: number
  transitionSeconds: number
  delivery: string
  effort: string
  stage: 'base' | 'rehearsal' | 'progressive'
}

export type DisciplinePreparationRoutine = {
  id: `access-prepare-${PreparationDiscipline}-${PreparationDuration}`
  discipline: PreparationDiscipline
  title: string
  durationMinutes: PreparationDuration
  summary: string
  purpose: string
  equipment: readonly string[]
  setup: readonly string[]
  entryCriteria: readonly string[]
  coverage: readonly string[]
  timeBudgetNote: string
  limitations: readonly string[]
  exitCriteria: readonly string[]
  progression: string
  steps: readonly PreparationStep[]
}

export const preparationClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export function preparationTimeline(routine: DisciplinePreparationRoutine) {
  let elapsed = 0
  return routine.steps.map((step, index) => {
    const start = elapsed
    elapsed += step.seconds
    return { ...step, order: index + 1, start, end: elapsed }
  })
}
