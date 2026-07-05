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

export function formatExerciseCardSummary(exercise: Exercise): string {
  if (exercise.card_summary) return exercise.card_summary
  const primary = primaryPhaseProfile(exercise)
  if (primary?.phaseName) return `${primary.phaseName} · fit ${primary.fitWeight}/5`
  return exercise.description?.slice(0, 120) ?? ''
}

export function whyPreview(why?: ExerciseWhy | null): string | null {
  if (!why) return null
  return why.training_purpose ?? why.short_summary ?? null
}
