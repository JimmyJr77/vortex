import { LOCOMOTION_PREPARATION_ROUTINES } from './locomotion'
import { LIFTING_PREPARATION_ROUTINES } from './lifting'
import { POWER_PREPARATION_ROUTINES } from './power'

export const DISCIPLINE_PREPARATION_ROUTINES = [
  ...LOCOMOTION_PREPARATION_ROUTINES,
  ...LIFTING_PREPARATION_ROUTINES,
  ...POWER_PREPARATION_ROUTINES,
]

export const DISCIPLINE_PREPARATION_CARDS = DISCIPLINE_PREPARATION_ROUTINES.map((routine) => ({
  kind: 'routine' as const,
  id: routine.id,
  title: routine.title,
  durationMinutes: routine.durationMinutes,
  category: `Preparation · ${routine.discipline.startsWith('lifting') ? 'Lifting' : routine.title}`,
  description: routine.summary,
  icon: 'prepare' as const,
}))

export const getDisciplinePreparationRoutine = (id: string) => DISCIPLINE_PREPARATION_ROUTINES.find((routine) => routine.id === id)
