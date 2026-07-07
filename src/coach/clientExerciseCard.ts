import { exerciseFitnessGoal } from './exerciseCard'
import { participantStructureLabel } from './types'
import type { Exercise, ExerciseCoachingExecution, ExerciseSafetyProfile } from './types'

export interface ClientExerciseView {
  title: string
  subtitle: string
  dosageLabel: string | null
  badges: string[]
  hasVideo: boolean
  whatIsThis: string | null
  howTo: string[]
  lookFor: string[]
  watchOutFor: string[]
  easierOption: string | null
  videoUrls: string[]
}

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return []
  return val.map((v) => String(v).trim()).filter(Boolean)
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const text = v?.trim()
    if (text) return text
  }
  return null
}

function limitItems(items: string[], max: number): string[] {
  return items.slice(0, max)
}

export function plainDosageLabel(exercise: Exercise): string | null {
  const parts: string[] = []
  if (exercise.default_sets != null) {
    parts.push(`${exercise.default_sets} set${exercise.default_sets === 1 ? '' : 's'}`)
  }
  if (exercise.default_reps != null) {
    parts.push(`${exercise.default_reps} rep${exercise.default_reps === 1 ? '' : 's'}`)
  } else if (exercise.default_work_seconds != null) {
    parts.push(`${exercise.default_work_seconds} sec work`)
  }
  if (exercise.est_seconds_per_set > 0) {
    parts.push(`about ${exercise.est_seconds_per_set} sec each`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

function clientBadges(exercise: Exercise): string[] {
  const badges: string[] = []
  const safety = exercise.safety_profile
  const impact =
    safety?.impact_level ??
    exercise.movement_requirements?.impact_level ??
    exercise.primary_phase?.impactLevel ??
    null

  if (exercise.participant_structure && exercise.participant_structure !== 'individual') {
    badges.push(`Do with ${participantStructureLabel(exercise.participant_structure).toLowerCase()}`)
  }
  if (safety?.requires_spotting) {
    badges.push('Needs spotting')
  }
  if (impact != null && impact >= 3) {
    badges.push('High impact')
  }
  const supervision = safety?.requires_coach_supervision?.trim().toLowerCase()
  if (supervision && supervision !== 'optional' && supervision !== 'none') {
    badges.push('Coach supervision required')
  }

  return limitItems(badges, 3)
}

function collectVideoUrls(exercise: Exercise): string[] {
  const urls = new Set<string>()
  for (const url of asStringArray(exercise.media_library?.demo_video_sources)) {
    urls.add(url)
  }
  for (const item of exercise.media ?? []) {
    if (item.kind === 'video' && item.url?.trim()) {
      urls.add(item.url.trim())
    }
  }
  return [...urls]
}

function buildHowTo(exec: ExerciseCoachingExecution | undefined): string[] {
  const setup = asStringArray(exec?.setup)
  const steps = asStringArray(exec?.execution_steps)
  return limitItems([...setup, ...steps], 6)
}

function buildLookFor(exec: ExerciseCoachingExecution | undefined): string[] {
  return limitItems([
    ...asStringArray(exec?.quality_gate),
    ...asStringArray(exec?.athlete_cues),
  ], 5)
}

function buildWatchOutFor(
  exec: ExerciseCoachingExecution | undefined,
  safety: ExerciseSafetyProfile | null | undefined,
): string[] {
  return limitItems([
    ...asStringArray(exec?.common_faults),
    ...asStringArray(exec?.stop_signs),
    ...asStringArray(safety?.contraindications),
  ], 5)
}

export function exerciseToClientView(exercise: Exercise): ClientExerciseView {
  const exec = exercise.coaching_execution
  const safety = exercise.safety_profile

  return {
    title: exercise.name,
    subtitle:
      firstNonEmpty(
        exercise.athlete_language,
        exercise.card_summary,
        exercise.why?.training_purpose,
        exerciseFitnessGoal(exercise),
      ) ?? exercise.name,
    dosageLabel: plainDosageLabel(exercise),
    badges: clientBadges(exercise),
    hasVideo: collectVideoUrls(exercise).length > 0,
    whatIsThis: firstNonEmpty(
      exec?.movement_description,
      exercise.athlete_language,
      exercise.description,
    ),
    howTo: buildHowTo(exec),
    lookFor: buildLookFor(exec),
    watchOutFor: buildWatchOutFor(exec, safety),
    easierOption: firstNonEmpty(
      ...(safety?.common_substitutions ?? []).slice(0, 1),
    ),
    videoUrls: collectVideoUrls(exercise),
  }
}
