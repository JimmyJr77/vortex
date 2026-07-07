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
  why_it_works?: string | null
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

export type PhaseSubrole =
  | 'raise'
  | 'mobilize'
  | 'activate'
  | 'integrate'
  | 'potentiate_bridge'
  | 'shape_position_intelligence'
  | 'rotation_inversion_tumbling_foundations'
  | 'locomotion_sprint_mechanics'
  | 'balance_coordination_rhythm'
  | 'perception_action_reactive_movement'
  | 'acceleration_start_speed'
  | 'max_velocity_exposure'
  | 'elastic_stiffness_plyometric_rudiments'
  | 'jump_throw_explosive_power'
  | 'deceleration_cod_power'
  | 'reactive_agility_tumbling_output'
  | 'squat_knee_dominant_strength'
  | 'hinge_posterior_chain_strength'
  | 'upper_body_push_strength'
  | 'pull_hang_grip_strength'
  | 'carry_trunk_loaded_bracing_strength'
  | 'tissue_capacity_isometric_eccentric_accessory'

export type ScalingCohortKey =
  | 'youth_beginner'
  | 'youth_intermediate'
  | 'teen'
  | 'adult_beginner'
  | 'adult_advanced'
  | 'older_adult'
  | 'pregnancy_postpartum'

export const SCALING_COHORT_KEYS: ScalingCohortKey[] = [
  'youth_beginner', 'youth_intermediate', 'teen', 'adult_beginner',
  'adult_advanced', 'older_adult', 'pregnancy_postpartum',
]

export const PHASE_SUBROLE_OPTIONS: Array<{ value: PhaseSubrole; label: string }> = [
  { value: 'raise', label: 'Raise' },
  { value: 'mobilize', label: 'Mobilize' },
  { value: 'activate', label: 'Activate' },
  { value: 'integrate', label: 'Integrate' },
  { value: 'potentiate_bridge', label: 'Potentiate bridge' },
  { value: 'shape_position_intelligence', label: 'Shape & position intelligence' },
  { value: 'rotation_inversion_tumbling_foundations', label: 'Rotation / tumbling foundations' },
  { value: 'locomotion_sprint_mechanics', label: 'Locomotion & sprint mechanics' },
  { value: 'balance_coordination_rhythm', label: 'Balance / coordination / rhythm' },
  { value: 'perception_action_reactive_movement', label: 'Perception-action / reactive' },
  { value: 'squat_knee_dominant_strength', label: 'Squat / knee-dominant strength' },
  { value: 'hinge_posterior_chain_strength', label: 'Hinge / posterior-chain strength' },
  { value: 'upper_body_push_strength', label: 'Upper-body push strength' },
  { value: 'pull_hang_grip_strength', label: 'Pull, hang & grip strength' },
  { value: 'carry_trunk_loaded_bracing_strength', label: 'Carry / trunk / loaded bracing' },
  { value: 'tissue_capacity_isometric_eccentric_accessory', label: 'Tissue capacity (iso/ecc/accessory)' },
]

export interface ExerciseMovementRequirements {
  primary_joint_actions?: string[]
  primary_tissues?: string[]
  primary_motor_control_demands?: string[]
  postural_shape?: string | null
  breathing_demand?: string | null
  balance_demand?: string | null
  coordination_demand?: string | null
  impact_level?: number | null
}

export interface ExerciseCoachingExecution {
  movement_description?: string | null
  setup?: string[]
  execution_steps?: string[]
  breathing_cues?: string[]
  coach_cues?: string[]
  athlete_cues?: string[]
  quality_gate?: string[]
  common_faults?: string[]
  stop_signs?: string[]
}

export interface ExercisePairingLogic {
  pairs_well_before?: string[]
  pairs_well_after?: string[]
  good_for_sessions?: string[]
  avoid_before?: string[]
  avoid_after?: string[]
  do_not_use_when?: string[]
}

export interface ExerciseMediaLibrary {
  demo_video_sources?: string[]
  coaching_articles?: string[]
  clinical_or_sport_science_references?: string[]
  internal_notes?: string[]
}

/** How many athletes an exercise needs. Spotters/coaches delivering cues don't count. */
export type ParticipantStructure = 'individual' | 'pairs' | 'group'

export const PARTICIPANT_STRUCTURE_OPTIONS: Array<{ value: ParticipantStructure; label: string }> = [
  { value: 'individual', label: 'Individual' },
  { value: 'pairs', label: 'Pairs' },
  { value: 'group', label: 'Group' },
]

export function participantStructureLabel(value?: ParticipantStructure | null): string {
  return PARTICIPANT_STRUCTURE_OPTIONS.find((o) => o.value === value)?.label ?? 'Individual'
}

export interface ExerciseMovementIdentity {
  name?: string
  slug?: string
  card_summary?: string | null
  coach_language?: string | null
  athlete_language?: string | null
  movement_family?: string | null
  phase_key?: string | null
  phase_subrole?: PhaseSubrole | null
  order_slot?: string | null
  sport_id?: number | null
  sport_name?: string | null
  skill_level?: string | null
  visibility?: 'facility' | 'private'
  participant_structure?: ParticipantStructure
}

export interface ExerciseCardPhaseProfile {
  role?: PhaseRole
  fit_weight?: number
  freshness_required?: boolean
  fatigue_sensitivity?: number
  fatigue_cost?: number
  technical_complexity?: number
  intensity_ceiling?: string | null
  daily_ok?: boolean
  notes?: string | null
}

export interface ExerciseCardDosage {
  default_sets?: number | null
  default_reps?: number | null
  default_work_seconds?: number | null
  default_rest_seconds?: number | null
  volume_unit?: string
  est_seconds_per_set?: number | null
  rpe_range?: string | null
  session_volume_min?: number | null
  session_volume_max?: number | null
}

export interface ExerciseCohortScaling {
  cohort_key?: ScalingCohortKey
  label?: string
  load_guidance?: string | null
  complexity_guidance?: string | null
  coach_notes?: string | null
  athlete_notes?: string | null
  requires_medical_clearance?: boolean
  gender_specific_notes?: string | null
  sets_min?: number | null
  sets_max?: number | null
  reps_min?: number | null
  reps_max?: number | null
  work_seconds_min?: number | null
  work_seconds_max?: number | null
}

export interface ExerciseCardSafety {
  risk_level?: number
  impact_level?: number
  requires_spotting?: boolean
  requires_supervision?: string
  readiness_checks?: string[]
  contraindications?: string[]
  substitutions?: string[]
}

export interface ExerciseCard {
  movement_identity: ExerciseMovementIdentity
  movement_requirements: ExerciseMovementRequirements
  taxonomy: {
    tenets: ExerciseTag[]
    methodologies: ExerciseTag[]
    physiology: ExerciseTag[]
    patterns: ExerciseTag[]
    equipment: ExerciseTag[]
    body_regions: ExerciseTag[]
  }
  phase_profile: ExerciseCardPhaseProfile | null
  phase_profiles?: ExercisePhaseProfile[]
  why_layer: ExerciseWhy | null
  coaching_execution: ExerciseCoachingExecution
  dosage: ExerciseCardDosage
  scaling: {
    scalable_variables: string[]
    gender_specific_notes?: string | null
    cohorts: Partial<Record<ScalingCohortKey, ExerciseCohortScaling>>
  }
  pairing_logic: ExercisePairingLogic
  safety_profile: ExerciseCardSafety | null
  media_and_document_library: ExerciseMediaLibrary & { media?: ExerciseMedia[] }
}

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
  cohort_key?: ScalingCohortKey | null
  label: string
  age_min?: number | null
  age_max?: number | null
  skill_level?: string | null
  scale_direction?: 'regression' | 'baseline' | 'progression' | null
  load_guidance?: string | null
  complexity_guidance?: string | null
  coach_notes?: string | null
  athlete_notes?: string | null
  requires_medical_clearance?: boolean
  gender_specific_notes?: string | null
  sets_min?: number | null
  sets_max?: number | null
  reps_min?: number | null
  reps_max?: number | null
  work_seconds_min?: number | null
  work_seconds_max?: number | null
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
  contraindications?: string[]
}

export interface ExerciseDifficultyProfile {
  technical: number
  load: number
  complexity: number
  overall: number
  recommended_age_min?: number | null
  recommended_age_max?: number | null
  attention_demand?: 'low' | 'moderate' | 'high' | null
  notes?: string | null
  source?: string | null
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

export type SkillKind = 'skill' | 'combo'
export type SkillEvaluationMode = 'execution' | 'duration' | 'repetitions'

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
  evaluation_mode: SkillEvaluationMode
  exercise_id?: number | null
  exercise_name?: string | null
  min_hold_seconds?: number | null
  default_hold_seconds?: number | null
  min_reps?: number | null
  default_reps?: number | null
  target_reps?: number | null
  execution_max_score?: number | null
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
  movement_family?: string | null
  primary_phase_key?: string | null
  phase_subrole?: PhaseSubrole | null
  primary_order_slot?: string | null
  participant_structure?: ParticipantStructure
  movement_requirements?: ExerciseMovementRequirements
  coaching_execution?: ExerciseCoachingExecution
  pairing_logic?: ExercisePairingLogic
  media_library?: ExerciseMediaLibrary
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
  difficulty_profile?: ExerciseDifficultyProfile | null
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

export type BlockFormat = 'straight_sets' | 'circuit' | 'amrap' | 'emom' | 'for_time' | 'stations' | 'interval' | 'density' | 'tempo' | 'relay' | 'game'

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
  programming_method_id?: number | null
  programming_method_slug?: string | null
  programming_method_name?: string | null
  quality_standard?: string | null
  stop_rules_json?: string[] | null
  scoring_mode?: string | null
  station_count?: number | null
  density_target?: string | null
  work_seconds?: number | null
  rest_seconds?: number | null
  items: WorkoutItem[]
}

export interface WorkoutCoachRationale {
  session_why?: string
  order_why?: string
  watch_points?: string[]
  audience_notes?: string
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
  subrole_key?: string | null
}

export interface PhaseSubroleRow {
  id: number
  key: PhaseSubrole
  name: string
  description?: string | null
  phase_key?: string
  order_index: number
  why_it_exists?: string | null
  what_belongs_here?: string | null
  what_to_avoid?: string | null
  fatigue_guidance?: string | null
  coach_guidance?: string | null
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
  examples_json?: unknown
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
    difficulty?: ExerciseDifficultyProfile | null
    age_fit?: 'good' | 'stretch' | 'over_cap'
  }>
}

export interface PrescriptionAudienceProfile {
  ageMin?: number | null
  ageMax?: number | null
  caps: {
    maxOverall: number
    maxTechnical: number
    maxLoad: number
    maxComplexity: number
  }
  scalingCohort?: string
  impliedSkillLevel?: string | null
  ageBandLabel?: string
  strengthIntent?: boolean
}

export interface PrescriptionResult {
  blocks: PrescribedBlock[]
  phase_rationales?: PrescriptionRationale[]
  candidates: Array<{ exercise_id: number; exercise_name: string; score: number; est_seconds_per_set: number; primary_phase?: string | null }>
  audience_profile?: PrescriptionAudienceProfile
  age_fit_warnings?: string[]
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

export interface ProgrammingMethodSummary {
  id: number
  name: string
  slug: string
  category: string
  definition?: string | null
  coach_summary?: string | null
  best_session_phase?: string | null
  compatible_session_phases?: string[]
  energy_system_focus?: string[]
  fatigue_level?: string
  technical_risk_under_fatigue?: string
  group_friendly?: boolean
  requires_timer?: boolean
  sample_work_rest?: string | null
  why_preview?: string | null
}

export interface ProgrammingMethod extends ProgrammingMethodSummary {
  athlete_summary?: string | null
  primary_development_goal?: string | null
  secondary_development_goals?: string[]
  programming_type?: string
  incompatible_phases?: string[]
  fatigue_profile?: Record<string, unknown>
  supervision_level?: string
  what_it_is?: string | null
  why_it_matters?: string | null
  when_to_use?: string | null
  when_not_to_use?: string | null
  common_misuse?: string[]
  work_rest_structure?: Record<string, unknown>
  exercise_compatibility?: Record<string, unknown>
  scaling?: Record<string, unknown>
  progression_logic?: Record<string, unknown>
  regression_logic?: Record<string, unknown>
  workout_builder_rules?: Record<string, unknown>
  phase_profiles?: Array<{ phaseKey: string; role: string; fitWeight: number; phaseRationale?: string | null }>
  prescriptions?: Array<Record<string, unknown>>
  quality_standards?: Array<{ standard: string; severity: string }>
  stop_rules?: Array<{ stopRule: string; severity: string }>
  validator_rules?: Array<{ ruleKey: string; message: string; severity: string }>
  example_implementations?: Array<{ label: string; audience: string; exampleJson: unknown; disclaimer?: string }>
}

export interface ProgrammingCard {
  identity: Record<string, unknown>
  classification: Record<string, unknown>
  education: Record<string, unknown>
  workRestStructure?: Record<string, unknown>
  exerciseCompatibility?: Record<string, unknown>
  qualityStandards?: Array<{ standard: string; severity: string }>
  stopRules?: Array<{ stopRule: string; severity: string }>
  validatorRules?: Array<{ ruleKey: string; message: string; severity: string }>
  exampleImplementations?: Array<Record<string, unknown>>
  workoutBuilderRules?: Record<string, unknown>
}

export type GameKind = 'game' | 'competition' | 'both'

export type GameType =
  | 'tag_and_chase'
  | 'territory_and_zone'
  | 'relay_and_race'
  | 'target_and_accuracy'
  | 'ball_object_control'
  | 'reaction_and_decision'
  | 'balance_body_control'
  | 'strength_power_play'
  | 'obstacle_ninja'
  | 'cooperative_team'
  | 'flexibility_shape'
  | 'structured_competition'

export type GameGroupStructure = 'individual' | 'pairs' | 'small_group' | 'large_group' | 'teams'

export type GameAgeBracket =
  | 'preschool'
  | 'elementary_young'
  | 'elementary_older'
  | 'middle_school'
  | 'high_school'
  | 'adult'

export interface GameTag {
  facet_type: string
  facet_id: number
  weight: number
  name?: string
  facet_key?: string
}

export interface Game {
  id: number
  name: string
  slug: string
  description?: string | null
  card_summary?: string | null
  coach_summary?: string | null
  athlete_summary?: string | null
  game_kind: GameKind
  game_kind_label?: string
  game_type: GameType
  game_type_label?: string
  competition_format?: string | null
  group_structure: GameGroupStructure
  group_structure_label?: string
  min_players: number
  max_players?: number | null
  ideal_players?: string | null
  age_brackets: GameAgeBracket[]
  age_bracket_labels?: string[]
  age_variations?: Record<string, { rules?: string; guidance?: string; space?: string }>
  space_requirements?: Record<string, unknown>
  equipment?: string[]
  duration_typical_min?: number | null
  duration_typical_max?: number | null
  intensity_level: string
  contact_level: string
  supervision_level?: string | null
  rules?: Record<string, unknown>
  safety?: Record<string, unknown>
  coaching_notes?: string | null
  best_session_phase?: string | null
  compatible_phases?: string[]
  migrated_from_exercise?: boolean
  source_exercise_id?: number | null
  tags?: GameTag[]
  primary_tenets?: string[]
  exercise_links?: Array<{ exercise_id: number; role: string; exercise_name?: string; exercise_slug?: string }>
  is_published?: boolean
  visibility?: string
}

