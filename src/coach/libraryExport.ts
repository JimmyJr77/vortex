import type { Exercise, Skill } from './types'
import type { FacetType } from './taxonomy'
import { EVALUATION_LABELS } from './skillCard'
import { exerciseFitnessGoal, phaseSubroleLabel } from './exerciseCard'
import { downloadJson, downloadXlsx } from '../utils/xlsxExport'

export type LibraryExportFormat = 'full-xlsx' | 'full-json' | 'simple-xlsx' | 'simple-json'

export const LIBRARY_EXPORT_OPTIONS: Array<{ value: LibraryExportFormat; label: string }> = [
  { value: 'full-xlsx', label: 'Full Excel (.xlsx)' },
  { value: 'full-json', label: 'Full JSON' },
  { value: 'simple-xlsx', label: 'Simple Excel (name & description)' },
  { value: 'simple-json', label: 'Simple JSON (name & description)' },
]

function joinList(values?: string[] | null): string {
  return (values ?? []).filter(Boolean).join('; ')
}

function tagLabels(ex: Exercise, facetType: FacetType, facetName: Map<number, string>): string {
  return (ex.tags ?? [])
    .filter((t) => t.facetType === facetType)
    .map((t) => {
      const name = facetName.get(t.facetId) ?? String(t.facetId)
      return t.weight > 1 ? `${name} (×${t.weight})` : name
    })
    .join('; ')
}

function exerciseDescription(ex: Exercise, facetName: Map<number, string>): string {
  return (
    ex.description?.trim()
    || ex.card_summary?.trim()
    || exerciseFitnessGoal(ex, facetName)
    || ''
  )
}

export function exerciseSimpleExportRows(exercises: Exercise[], facetName: Map<number, string>) {
  return exercises.map((ex) => ({
    name: ex.name,
    description: exerciseDescription(ex, facetName),
  }))
}

export function exerciseFullExportRows(exercises: Exercise[], facetName: Map<number, string>) {
  return exercises.map((ex) => {
    const exec = ex.coaching_execution ?? {}
    const req = ex.movement_requirements ?? {}
    const why = ex.why ?? {}
    const pairing = ex.pairing_logic ?? {}
    const safety = ex.safety_profile ?? {}
    const regimen = ex.regimen_rule ?? {}
    const prog = ex.programming_logic ?? {}
    const media = ex.media_library ?? {}
    const primary = ex.primary_phase ?? ex.phase_profiles?.[0]
    const dosage = ex.dosage_profiles?.[0]

    return {
      id: ex.id,
      name: ex.name,
      slug: ex.slug ?? '',
      description: ex.description ?? '',
      card_summary: ex.card_summary ?? '',
      fitness_goal: exerciseFitnessGoal(ex, facetName),
      instructions: ex.instructions ?? '',
      sport: ex.sport_name ?? '',
      skill_level: ex.skill_level ?? '',
      movement_family: ex.movement_family ?? '',
      coach_language: ex.coach_language ?? '',
      athlete_language: ex.athlete_language ?? '',
      primary_phase: ex.primary_phase_key ?? primary?.phaseKey ?? '',
      phase_subrole: phaseSubroleLabel(ex.phase_subrole) ?? '',
      order_slot: ex.primary_order_slot ?? primary?.orderSlot ?? '',
      tenets: tagLabels(ex, 'tenet', facetName),
      methodologies: tagLabels(ex, 'methodology', facetName),
      physiology: tagLabels(ex, 'physiology', facetName),
      patterns: tagLabels(ex, 'pattern', facetName),
      equipment: tagLabels(ex, 'equipment', facetName),
      body_regions: tagLabels(ex, 'body_region', facetName),
      phase_profiles: JSON.stringify(ex.phase_profiles ?? []),
      default_sets: dosage?.default_sets ?? ex.default_sets ?? '',
      default_reps: dosage?.default_reps ?? ex.default_reps ?? '',
      default_work_seconds: dosage?.default_work_seconds ?? ex.default_work_seconds ?? '',
      default_rest_seconds: dosage?.default_rest_seconds ?? ex.default_rest_seconds ?? '',
      est_seconds_per_set: ex.est_seconds_per_set ?? '',
      tempo: ex.tempo ?? '',
      load_note: ex.load_note ?? '',
      movement_description: exec.movement_description ?? '',
      setup: joinList(exec.setup),
      execution_steps: joinList(exec.execution_steps),
      breathing_cues: joinList(exec.breathing_cues),
      coach_cues: joinList(exec.coach_cues),
      athlete_cues: joinList(exec.athlete_cues),
      quality_gate: joinList(exec.quality_gate),
      common_faults: joinList(exec.common_faults),
      stop_signs: joinList(exec.stop_signs),
      primary_joint_actions: joinList(req.primary_joint_actions),
      primary_tissues: joinList(req.primary_tissues),
      motor_control_demands: joinList(req.primary_motor_control_demands),
      postural_shape: req.postural_shape ?? '',
      breathing_demand: req.breathing_demand ?? '',
      balance_demand: req.balance_demand ?? '',
      coordination_demand: req.coordination_demand ?? '',
      why_training_purpose: why.training_purpose ?? '',
      why_it_works: why.why_it_works ?? '',
      tenet_rationale: why.tenet_rationale ?? '',
      methodology_rationale: why.methodology_rationale ?? '',
      physiological_rationale: why.physiological_rationale ?? '',
      phase_rationale: why.phase_rationale ?? '',
      order_rationale: why.order_rationale ?? '',
      fatigue_rationale: why.fatigue_rationale ?? '',
      scaling_rationale: why.scaling_rationale ?? '',
      regimen_rationale: why.regimen_rationale ?? '',
      common_misuse: why.common_misuse ?? '',
      short_summary: why.short_summary ?? '',
      pairs_well_before: joinList(pairing.pairs_well_before),
      pairs_well_after: joinList(pairing.pairs_well_after),
      good_for_sessions: joinList(pairing.good_for_sessions),
      avoid_before: joinList(pairing.avoid_before),
      avoid_after: joinList(pairing.avoid_after),
      do_not_use_when: joinList(pairing.do_not_use_when),
      training_effect: prog.training_effect ?? '',
      best_used_for: joinList(prog.best_used_for),
      avoid_when: joinList(prog.avoid_when),
      recommended_preceded_by: joinList(prog.recommended_preceded_by),
      recommended_followed_by: joinList(prog.recommended_followed_by),
      scalable_variables: joinList(ex.scalable_variables),
      scaling_profiles: JSON.stringify(ex.scaling_profiles ?? []),
      risk_level: safety.risk_level ?? '',
      impact_level: safety.impact_level ?? '',
      requires_spotting: safety.requires_spotting ?? '',
      requires_coach_supervision: safety.requires_coach_supervision ?? '',
      readiness_checks: joinList(safety.readiness_checks),
      contraindications: joinList(safety.contraindications),
      common_substitutions: joinList(safety.common_substitutions),
      can_be_daily: regimen.can_be_daily ?? '',
      weekly_max_frequency: regimen.weekly_max_frequency ?? '',
      minimum_hours_between_hard_exposures: regimen.minimum_hours_between_hard_exposures ?? '',
      recovery_notes: regimen.recovery_notes ?? '',
      demo_video_sources: joinList(media.demo_video_sources),
      coaching_articles: joinList(media.coaching_articles),
      clinical_references: joinList(media.clinical_or_sport_science_references),
      internal_notes: joinList(media.internal_notes),
      is_published: ex.is_published ?? '',
      visibility: ex.visibility ?? '',
    }
  })
}

export function skillSimpleExportRows(skills: Skill[]) {
  return skills.map((sk) => ({
    name: sk.name,
    description: sk.description?.trim() ?? '',
  }))
}

export function skillFullExportRows(skills: Skill[]) {
  return skills.map((sk) => ({
    id: sk.id,
    name: sk.name,
    slug: sk.slug ?? '',
    description: sk.description ?? '',
    instructions: sk.instructions ?? '',
    sport: sk.sport_name ?? '',
    skill_level: sk.skill_level ?? '',
    skill_kind: sk.skill_kind === 'combo' ? 'Combo' : 'Skill',
    evaluation_mode: EVALUATION_LABELS[sk.evaluation_mode ?? 'execution'],
    linked_exercise: sk.exercise_name ?? '',
    linked_exercise_id: sk.exercise_id ?? '',
    min_hold_seconds: sk.min_hold_seconds ?? '',
    default_hold_seconds: sk.default_hold_seconds ?? '',
    min_reps: sk.min_reps ?? '',
    default_reps: sk.default_reps ?? '',
    target_reps: sk.target_reps ?? '',
    execution_max_score: sk.execution_max_score ?? '',
    assistance_note: sk.assistance_note ?? '',
    combo_components: (sk.components ?? []).map((c) => c.name ?? `#${c.component_skill_id}`).join(' → '),
    prerequisites: (sk.prerequisites ?? [])
      .map((p) => (p.note ? `${p.name ?? `#${p.prerequisite_skill_id}`} (${p.note})` : p.name ?? `#${p.prerequisite_skill_id}`))
      .join('; '),
    is_published: sk.is_published ?? '',
    visibility: sk.visibility ?? '',
  }))
}

export function exportExercises(
  exercises: Exercise[],
  format: LibraryExportFormat,
  facetName: Map<number, string>,
  filenameStem: string,
): void {
  if (format === 'simple-json') {
    downloadJson(exerciseSimpleExportRows(exercises, facetName), `${filenameStem}-simple.json`)
    return
  }
  if (format === 'full-json') {
    downloadJson(exercises, `${filenameStem}-full.json`)
    return
  }
  if (format === 'simple-xlsx') {
    downloadXlsx(exerciseSimpleExportRows(exercises, facetName), `${filenameStem}-simple`, 'Exercises')
    return
  }
  downloadXlsx(exerciseFullExportRows(exercises, facetName), `${filenameStem}-full`, 'Exercises')
}

export function exportSkills(skills: Skill[], format: LibraryExportFormat, filenameStem: string): void {
  if (format === 'simple-json') {
    downloadJson(skillSimpleExportRows(skills), `${filenameStem}-simple.json`)
    return
  }
  if (format === 'full-json') {
    downloadJson(skills, `${filenameStem}-full.json`)
    return
  }
  if (format === 'simple-xlsx') {
    downloadXlsx(skillSimpleExportRows(skills), `${filenameStem}-simple`, 'Skills')
    return
  }
  downloadXlsx(skillFullExportRows(skills), `${filenameStem}-full`, 'Skills')
}
