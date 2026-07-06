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

export interface ExerciseWhy {
  training_purpose?: string | null
  tenet_rationale?: string | null
  methodology_rationale?: string | null
  physiological_rationale?: string | null
  phase_rationale?: string | null
  order_rationale?: string | null
  fatigue_rationale?: string | null
  scaling_rationale?: string | null
  regimen_rationale?: string | null
  common_misuse?: string | null
  short_summary?: string | null
  coach_cues?: string | null
}

export type PhaseRole = 'primary' | 'secondary' | 'conditional' | 'avoid'

export interface ExercisePhaseProfile {
  phaseId: number
  phaseKey: string
  phaseName: string
  fitWeight: number
  role: PhaseRole
  orderSlot?: string | null
  orderIndex?: number
  freshnessRequired?: boolean
  fatigueSensitivity?: number
  fatigueCost?: number
  technicalComplexity?: number
  impactLevel?: number
  intensityCeiling?: string | null
  notes?: string | null
}

export interface ExerciseDosageProfile {
  profile_name?: string
  volume_unit?: string
  default_sets?: number | null
  default_reps?: number | null
  default_work_seconds?: number | null
  default_rest_seconds?: number | null
  est_seconds_per_set?: number | null
  session_volume_min?: number | null
  session_volume_max?: number | null
  weekly_volume_max?: number | null
  default_rpe_min?: number | null
  default_rpe_max?: number | null
}

export interface ExerciseScalingProfile {
  id?: number
  label: string
  age_min?: number | null
  age_max?: number | null
  skill_level?: string | null
  scale_direction?: 'regression' | 'baseline' | 'progression' | null
  load_guidance?: string | null
  complexity_guidance?: string | null
  coach_notes?: string | null
}

export interface ExerciseSafetyProfile {
  risk_level?: number
  impact_level?: number
  requires_spotting?: boolean
  requires_coach_supervision?: string
  minimum_age_recommended?: number | null
  minimum_skill_level?: string | null
  readiness_checks?: string[]
  stop_signs?: string[]
  common_substitutions?: string[]
}

export interface ExerciseRegimenRule {
  can_be_daily?: boolean
  weekly_max_frequency?: number
  minimum_hours_between_hard_exposures?: number
  counts_as_high_intensity?: boolean
  counts_as_high_impact?: boolean
  counts_as_neural?: boolean
  counts_as_tissue_stress?: boolean
  counts_as_conditioning?: boolean
  recovery_notes?: string | null
}

export interface ExerciseProgrammingLogic {
  training_effect?: string
  best_used_for?: string[]
  avoid_when?: string[]
  recommended_preceded_by?: string[]
  recommended_followed_by?: string[]
}

export interface SkillComponentRow {
  component_skill_id: number
  name?: string
  sort_order?: number
}

export interface SkillPrerequisiteRow {
  prerequisite_skill_id: number
  name?: string
  note?: string | null
}

export type SkillKind = 'skill' | 'combo' | 'hold'

export interface Skill {
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
  skill_kind: SkillKind
  min_hold_seconds?: number | null
  default_hold_seconds?: number | null
  assistance_note?: string | null
  is_published?: boolean
  visibility?: 'facility' | 'private'
  components?: SkillComponentRow[]
  prerequisites?: SkillPrerequisiteRow[]
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
  card_summary?: string | null
  coach_language?: string | null
  athlete_language?: string | null
  programming_logic?: ExerciseProgrammingLogic
  scalable_variables?: string[]
  why_publish_ready?: boolean
  tags?: ExerciseTag[]
  media?: ExerciseMedia[]
  cues?: ExerciseCue[]
  prerequisites?: Array<{ prerequisite_exercise_id: number; name: string; note?: string | null }>
  phase_profiles?: ExercisePhaseProfile[]
  primary_phase?: ExercisePhaseProfile | null
  dosage_profiles?: ExerciseDosageProfile[]
  scaling_profiles?: ExerciseScalingProfile[]
  safety_profile?: ExerciseSafetyProfile | null
  regimen_rule?: ExerciseRegimenRule | null
  why?: ExerciseWhy | null
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
  phase_id?: number | null
  phase_key?: string | null
  order_slot?: string | null
  phase_order_index?: number | null
  minutes_budget?: number | null
  phase_goal?: string | null
  contains_tumbling?: boolean
  add_on_focus?: string | null
  items: WorkoutItem[]
}

export interface WorkoutCoachRationale {
  session_why?: string
  order_why?: string
  watch_points?: string[]
}

export interface WorkoutSessionFormat {
  tumbling_minutes?: number
  tumbling_placement?: string
  add_on_minutes?: number
  add_on_focus?: string
}

export interface WorkoutAudience {
  age_min?: number | null
  age_max?: number | null
  skill_level?: string | null
  sport_id?: number | null
  equipment_ids?: number[]
  exclusions?: string[]
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
  duration_minutes?: number | null
  session_objective?: string | null
  audience_json?: WorkoutAudience
  format_json?: WorkoutSessionFormat
  coach_rationale_json?: WorkoutCoachRationale
  phase_plan_json?: Array<{ phaseKey: string; minutes: number; label?: string }>
  validation_snapshot_json?: ValidationResult
  validation_override_reason?: string | null
  notes?: string | null
  computed_minutes?: number
  blocks: WorkoutBlock[]
}

export interface SessionPhase {
  id: number
  key: string
  name: string
  description?: string | null
  order_index: number
  freshness_required?: boolean
  can_be_daily?: boolean
  default_min_percent?: number | null
  default_max_percent?: number | null
  fatigue_sensitivity?: number | null
}

export interface PhaseOrderSlot {
  id: number
  key: string
  name: string
  description?: string | null
  phase_id: number
  phase_key?: string
  order_index: number
  freshness_sensitivity?: number | null
}

export interface EducationContent {
  id?: number
  entity_type: string
  entity_key: string
  entity_id?: number | null
  title?: string | null
  short_summary?: string | null
  what_it_is?: string | null
  why_it_matters?: string | null
  why_it_goes_here?: string | null
  why_this_order?: string | null
  fatigue_logic?: string | null
  programming_guidance?: string | null
  common_misuse?: string | null
  scaling_guidance?: string | null
  why?: ExerciseWhy | null
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'recommendation'
  rule_key?: string
  message: string
  why?: string | null
  recommendation?: string | null
  affected_items?: string[]
  related_phase?: string | null
  can_override?: boolean
  override_requires_reason?: boolean
}

export interface ValidationTimeSummary {
  planned_seconds?: number
  budget_seconds?: number
  delta_seconds?: number
  planned_minutes?: number
  budget_minutes?: number | null
}

export interface ValidationResult {
  status: 'valid' | 'warning' | 'error'
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  recommendations: ValidationIssue[]
  coverage?: Record<string, unknown>
  fatigue?: Record<string, unknown>
  time?: ValidationTimeSummary
}

export interface PrescriptionRationale {
  phase_key?: string
  phase_name?: string
  phase_rationale?: string | null
}

export interface PrescribedBlock {
  label: string
  phase_key?: string | null
  phase_id?: number | null
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
    phase_fit?: number
    selection_rationale?: string | null
    placement_rationale?: string | null
    scaling_rationale?: string | null
  }>
}

export interface PrescriptionResult {
  blocks: PrescribedBlock[]
  phase_rationales?: PrescriptionRationale[]
  candidates: Array<{ exercise_id: number; exercise_name: string; score: number; est_seconds_per_set: number; primary_phase?: string | null }>
}

export interface SessionPhaseTemplate {
  key: string
  title: string
  summary?: string | null
  phase_plan?: Array<{ phaseKey: string; minutes: number; label?: string }>
}

export interface TrainingBlockTemplate {
  id?: number
  name: string
  description?: string | null
  duration_days?: number
  sessions_per_week?: number
  target_population?: string | null
  sport_id?: number | null
  primary_goal?: string | null
  secondary_goals?: string[]
  weekly_rules_json?: Record<string, unknown>
  regimen_rationale_json?: Record<string, unknown>
  sessions?: TrainingBlockSession[]
  rule?: TrainingBlockRule | null
}

export interface TrainingBlockSession {
  day_index: number
  session_name?: string | null
  session_objective?: string | null
  duration_minutes?: number | null
  format_json?: Record<string, unknown>
  workout_id?: number | null
  day_rationale?: string | null
}

export interface TrainingBlockRule {
  minimum_hours_between_hard_neural?: number
  minimum_hours_between_high_impact?: number
  max_hiit_sessions_per_week?: number
  daily_mobility_required?: boolean
}

export interface RegimenTemplate {
  id?: number
  name: string
  description?: string | null
  population?: string | null
  duration_type?: string
  weeks?: number
  sessions_per_week?: number
  regimen_rationale_json?: Record<string, unknown>
  phase_distributions?: Array<{ phase_id: number; phase_key?: string; default_minutes?: number; default_percent?: number }>
  session_templates?: Array<{ week_number: number; day_of_week?: number; duration_minutes: number; phase_plan_json?: unknown[] }>
}
