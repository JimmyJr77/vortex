import type { FacetType } from './taxonomy'

export interface ExerciseTag {
  facetType: FacetType
  facetId: number
  weight: number
}

export interface ExerciseMedia {
  id?: number
  kind: 'video' | 'image' | 'diagram'
  url: string
  caption?: string | null
}

export interface ExerciseCue {
  id?: number
  cue_type: 'cue' | 'fault'
  body: string
}

export interface Exercise {
  id: number
  name: string
  slug?: string
  description?: string | null
  instructions?: string | null
  sport_id?: number | null
  sport_name?: string | null
  skill_level?: string | null
  age_min?: number | null
  age_max?: number | null
  default_sets?: number | null
  default_reps?: number | null
  default_work_seconds?: number | null
  default_rest_seconds?: number | null
  tempo?: string | null
  load_note?: string | null
  est_seconds_per_set: number
  is_published?: boolean
  visibility?: 'facility' | 'private'
  tags?: ExerciseTag[]
  media?: ExerciseMedia[]
  cues?: ExerciseCue[]
  prerequisites?: Array<{ prerequisite_exercise_id: number; name: string; note?: string | null }>
}

export interface WorkoutItem {
  id?: number
  exercise_id: number | null
  exercise_name?: string | null
  sets?: number | null
  reps?: number | null
  work_seconds?: number | null
  rest_seconds?: number | null
  load?: string | null
  tempo?: string | null
  coaching_note?: string | null
  est_seconds_per_set?: number | null
}

export type BlockFormat = 'straight_sets' | 'circuit' | 'amrap' | 'emom' | 'for_time' | 'stations'

export interface WorkoutBlock {
  id?: number
  label?: string | null
  block_format: BlockFormat
  rounds: number
  rest_between_rounds_seconds: number
  cap_minutes?: number | null
  items: WorkoutItem[]
}

export type WorkoutType = 'workout' | 'warmup' | 'cooldown' | 'conditioning' | 'practice'

export interface Workout {
  id?: number
  title: string
  type: WorkoutType
  sport_id?: number | null
  sport_name?: string | null
  description?: string | null
  target_minutes?: number | null
  notes?: string | null
  computed_minutes?: number
  blocks: WorkoutBlock[]
}

export interface PrescribedBlock {
  label: string
  intentId: number | null
  target_minutes: number
  estimated_minutes: number
  items: Array<{
    exercise_id: number
    exercise_name: string
    sets: number
    reps?: number | null
    work_seconds?: number | null
    rest_seconds?: number | null
    est_seconds_per_set: number
    score: number
  }>
}

export interface PrescriptionResult {
  blocks: PrescribedBlock[]
  candidates: Array<{ exercise_id: number; exercise_name: string; score: number; est_seconds_per_set: number }>
}
