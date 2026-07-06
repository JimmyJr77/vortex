import type { Exercise, ExercisePhaseProfile, ExerciseWhy } from './types'

export function primaryPhaseProfile(exercise: Exercise): ExercisePhaseProfile | null {
  const profiles = exercise.phase_profiles ?? []
  return profiles.find((p) => p.role === 'primary') ?? profiles[0] ?? null
}

export function phaseFitBadge(exercise: Exercise, phaseKey?: string | null): 'strong' | 'conditional' | 'avoid' | 'unknown' {
  if (!phaseKey) return 'unknown'
  const profile = (exercise.phase_profiles ?? []).find((p) => p.phaseKey === phaseKey)
  if (!profile) return 'unknown'
  if (profile.role === 'avoid') return 'avoid'
  if (profile.role === 'primary' || profile.fitWeight >= 4) return 'strong'
  return 'conditional'
}

/** Top tenet names for this exercise, highest tag weight first. */
export function exerciseTenetLabels(exercise: Exercise, tenetName: Map<number, string>): string[] {
  return (exercise.tags ?? [])
    .filter((t) => t.facetType === 'tenet')
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, 3)
    .map((t) => tenetName.get(Number(t.facetId)))
    .filter((name): name is string => Boolean(name))
}

/**
 * Primary card line for exercises: what fitness outcome this movement serves.
 * Skills library handles demonstrated ability; exercises are about training toward tenets/goals.
 */
export function exerciseFitnessGoal(exercise: Exercise, tenetName?: Map<number, string>): string {
  if (exercise.card_summary?.trim()) return exercise.card_summary.trim()
  const why = exercise.why
  if (why?.training_purpose?.trim()) return why.training_purpose.trim()
  if (why?.short_summary?.trim()) return why.short_summary.trim()
  const effect = exercise.programming_logic?.training_effect?.trim()
  if (effect) return effect
  const tenets = tenetName ? exerciseTenetLabels(exercise, tenetName) : []
  if (tenets.length === 1) return `Trains ${tenets[0]} toward session fitness goals.`
  if (tenets.length > 1) return `Trains ${tenets.slice(0, 2).join(' and ')} toward session fitness goals.`
  if (exercise.description?.trim()) return exercise.description.trim()
  return 'Supports athletic development through programmed training load.'
}

/** @deprecated Use exerciseFitnessGoal — kept for existing imports. */
export function formatExerciseCardSummary(exercise: Exercise, tenetName?: Map<number, string>): string {
  return exerciseFitnessGoal(exercise, tenetName)
}

export function exerciseSessionPhaseHint(exercise: Exercise): string | null {
  const primary = exercise.primary_phase ?? primaryPhaseProfile(exercise)
  if (!primary?.phaseName) return null
  return `Programmed for ${primary.phaseName}`
}

export function exerciseDosageLabel(exercise: Exercise): string {
  const parts: string[] = []
  if (exercise.default_sets) parts.push(`${exercise.default_sets} sets`)
  if (exercise.default_reps != null) parts.push(`${exercise.default_reps} reps`)
  else if (exercise.default_work_seconds) parts.push(`${exercise.default_work_seconds}s work`)
  parts.push(`${exercise.est_seconds_per_set}s/set`)
  return parts.join(' · ')
}

export function whyPreview(why?: ExerciseWhy | null): string | null {
  if (!why) return null
  return why.tenet_rationale ?? why.methodology_rationale ?? why.phase_rationale ?? null
}
