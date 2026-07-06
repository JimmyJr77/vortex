import type { FacetType, Taxonomy } from './taxonomy'
import { subroleForOrderSlot } from './taxonomy'
import type {
  Exercise,
  ExerciseCard,
  ExerciseCoachingExecution,
  ExerciseCohortScaling,
  ExerciseMovementRequirements,
  ExercisePhaseProfile,
  ExerciseWhy,
  PhaseSubrole,
  ScalingCohortKey,
} from './types'
import { PHASE_SUBROLE_OPTIONS, SCALING_COHORT_KEYS } from './types'

export { PHASE_SUBROLE_OPTIONS, SCALING_COHORT_KEYS }

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return []
  return val.map((v) => String(v).trim()).filter(Boolean)
}

export function phaseSubroleLabel(subrole?: string | null): string | null {
  if (!subrole) return null
  return PHASE_SUBROLE_OPTIONS.find((o) => o.value === subrole)?.label ?? subrole.replace(/_/g, ' ')
}

export function movementFamilyLabel(family?: string | null): string | null {
  if (!family?.trim()) return null
  return family.trim()
}

export function exerciseToCard(exercise: Exercise, taxonomy?: Taxonomy | null): ExerciseCard {
  const tags = exercise.tags ?? []
  const primary = exercise.primary_phase ?? primaryPhaseProfile(exercise)
  const phaseKey = exercise.primary_phase_key ?? primary?.phaseKey ?? null
  const orderSlot = exercise.primary_order_slot ?? primary?.orderSlot ?? null
  const derivedSubrole = subroleForOrderSlot(taxonomy, phaseKey, orderSlot) as PhaseSubrole | null
  const phaseSubrole: PhaseSubrole | null = derivedSubrole ?? exercise.phase_subrole ?? null
  const dosage = exercise.dosage_profiles?.[0]
  const regimen = exercise.regimen_rule
  const safety = exercise.safety_profile
  const why = exercise.why
  const req = (exercise.movement_requirements ?? {}) as ExerciseMovementRequirements
  const exec = (exercise.coaching_execution ?? {}) as ExerciseCoachingExecution
  const pairing = exercise.pairing_logic ?? {}
  const mediaLib = exercise.media_library ?? {}

  const cohorts: Partial<Record<ScalingCohortKey, ExerciseCohortScaling>> = {}
  let genderNotes: string | null = null
  for (const key of SCALING_COHORT_KEYS) {
    const row = (exercise.scaling_profiles ?? []).find((s) => s.cohort_key === key)
    if (row) cohorts[key] = { ...row, cohort_key: key }
    if (row?.gender_specific_notes) genderNotes = row.gender_specific_notes
  }

  return {
    movement_identity: {
      name: exercise.name,
      slug: exercise.slug,
      card_summary: exercise.card_summary,
      coach_language: exercise.coach_language,
      athlete_language: exercise.athlete_language,
      movement_family: exercise.movement_family,
      phase_key: phaseKey,
      phase_subrole: phaseSubrole,
      order_slot: orderSlot,
      sport_id: exercise.sport_id,
      sport_name: exercise.sport_name,
      skill_level: exercise.skill_level,
      visibility: exercise.visibility,
      participant_structure: exercise.participant_structure ?? 'individual',
    },
    movement_requirements: {
      primary_joint_actions: asStringArray(req.primary_joint_actions),
      primary_tissues: asStringArray(req.primary_tissues),
      primary_motor_control_demands: asStringArray(req.primary_motor_control_demands),
      postural_shape: req.postural_shape ?? null,
      breathing_demand: req.breathing_demand ?? null,
      balance_demand: req.balance_demand ?? null,
      coordination_demand: req.coordination_demand ?? null,
      impact_level: req.impact_level ?? primary?.impactLevel ?? safety?.impact_level ?? null,
    },
    taxonomy: {
      tenets: tags.filter((t) => t.facetType === 'tenet'),
      methodologies: tags.filter((t) => t.facetType === 'methodology'),
      physiology: tags.filter((t) => t.facetType === 'physiology'),
      patterns: tags.filter((t) => t.facetType === 'pattern'),
      equipment: tags.filter((t) => t.facetType === 'equipment'),
      body_regions: tags.filter((t) => t.facetType === 'body_region'),
    },
    phase_profile: primary ? {
      role: primary.role,
      fit_weight: primary.fitWeight,
      freshness_required: primary.freshnessRequired,
      fatigue_sensitivity: primary.fatigueSensitivity,
      fatigue_cost: primary.fatigueCost,
      technical_complexity: primary.technicalComplexity,
      intensity_ceiling: primary.intensityCeiling,
      daily_ok: Boolean(regimen?.can_be_daily),
      notes: primary.notes,
    } : null,
    phase_profiles: exercise.phase_profiles,
    why_layer: why ?? null,
    coaching_execution: {
      movement_description: exec.movement_description ?? exercise.description ?? null,
      setup: asStringArray(exec.setup),
      execution_steps: asStringArray(exec.execution_steps),
      breathing_cues: asStringArray(exec.breathing_cues),
      coach_cues: asStringArray(exec.coach_cues),
      athlete_cues: asStringArray(exec.athlete_cues),
      quality_gate: asStringArray(exec.quality_gate),
      common_faults: asStringArray(exec.common_faults),
      stop_signs: asStringArray(exec.stop_signs),
    },
    dosage: {
      default_sets: dosage?.default_sets ?? exercise.default_sets,
      default_reps: dosage?.default_reps ?? exercise.default_reps,
      default_work_seconds: dosage?.default_work_seconds ?? exercise.default_work_seconds,
      default_rest_seconds: dosage?.default_rest_seconds ?? exercise.default_rest_seconds,
      volume_unit: dosage?.volume_unit ?? 'reps',
      est_seconds_per_set: dosage?.est_seconds_per_set ?? exercise.est_seconds_per_set,
      rpe_range: dosage?.default_rpe_min != null || dosage?.default_rpe_max != null
        ? `${dosage?.default_rpe_min ?? '—'}-${dosage?.default_rpe_max ?? '—'}`
        : null,
      session_volume_min: dosage?.session_volume_min,
      session_volume_max: dosage?.session_volume_max,
    },
    scaling: {
      scalable_variables: exercise.scalable_variables ?? [],
      gender_specific_notes: genderNotes,
      cohorts,
    },
    pairing_logic: {
      pairs_well_before: asStringArray(pairing.pairs_well_before ?? exercise.programming_logic?.recommended_preceded_by),
      pairs_well_after: asStringArray(pairing.pairs_well_after ?? exercise.programming_logic?.recommended_followed_by),
      good_for_sessions: asStringArray(pairing.good_for_sessions ?? exercise.programming_logic?.best_used_for),
      avoid_before: asStringArray(pairing.avoid_before),
      avoid_after: asStringArray(pairing.avoid_after),
      do_not_use_when: asStringArray(pairing.do_not_use_when ?? exercise.programming_logic?.avoid_when),
    },
    safety_profile: safety ? {
      risk_level: safety.risk_level,
      impact_level: safety.impact_level,
      requires_spotting: safety.requires_spotting,
      requires_supervision: safety.requires_coach_supervision,
      readiness_checks: safety.readiness_checks ?? [],
      contraindications: safety.contraindications ?? [],
      substitutions: safety.common_substitutions ?? [],
    } : null,
    media_and_document_library: {
      demo_video_sources: asStringArray(mediaLib.demo_video_sources),
      coaching_articles: asStringArray(mediaLib.coaching_articles),
      clinical_or_sport_science_references: asStringArray(mediaLib.clinical_or_sport_science_references),
      internal_notes: asStringArray(mediaLib.internal_notes),
      media: exercise.media,
    },
  }
}

export function exerciseSubroleAndSlotLine(exercise: Exercise, taxonomy?: Taxonomy | null): string | null {
  const card = exerciseToCard(exercise, taxonomy)
  const subrole = phaseSubroleLabel(card.movement_identity.phase_subrole)
  const slotKey = card.movement_identity.order_slot
  const slot = slotKey ? (taxonomy?.phaseOrderSlots?.find((s) => s.key === slotKey)?.name ?? slotKey.replace(/_/g, ' ')) : null
  const parts = []
  if (subrole) parts.push(`Subrole: ${subrole}`)
  if (slot) parts.push(`Slot: ${slot}`)
  return parts.length ? parts.join(' · ') : null
}

export function exerciseIdentityLine(exercise: Exercise, taxonomy?: Taxonomy | null): string | null {
  const card = exerciseToCard(exercise, taxonomy)
  const parts: string[] = []
  if (card.movement_identity.movement_family) parts.push(card.movement_identity.movement_family)
  const phaseKey = card.movement_identity.phase_key
  const phaseName = taxonomy?.sessionPhases?.find((p) => p.key === phaseKey)?.name
  if (phaseName) parts.push(phaseName)
  const subrole = phaseSubroleLabel(card.movement_identity.phase_subrole)
  if (subrole) parts.push(subrole)
  if (card.movement_identity.order_slot) {
    const slot = taxonomy?.phaseOrderSlots?.find((s) => s.key === card.movement_identity.order_slot)?.name
    parts.push(slot ?? card.movement_identity.order_slot)
  }
  return parts.length ? parts.join(' · ') : null
}

export function exerciseRequirementChips(exercise: Exercise): string[] {
  const req = exercise.movement_requirements ?? {}
  const chips = [
    ...asStringArray(req.primary_joint_actions).slice(0, 2),
    req.breathing_demand,
    req.balance_demand,
  ].filter((v): v is string => Boolean(v && String(v).trim()))
  return chips
}

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

/** Tag labels for a facet type, highest weight first. */
export function exerciseFacetLabels(
  exercise: Exercise,
  facetType: FacetType,
  facetName: Map<string | number, string>,
  limit = 3,
): string[] {
  return (exercise.tags ?? [])
    .filter((t) => t.facetType === facetType)
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, limit)
    .map((t) => facetName.get(`${facetType}:${Number(t.facetId)}`) ?? facetName.get(Number(t.facetId)))
    .filter((name): name is string => Boolean(name))
}

/** Top tenet names for this exercise, highest tag weight first. */
export function exerciseTenetLabels(exercise: Exercise, tenetName: Map<string | number, string>): string[] {
  return exerciseFacetLabels(exercise, 'tenet', tenetName, 3)
}

/**
 * Primary card line for exercises: what fitness outcome this movement serves.
 * Skills library handles demonstrated ability; exercises are about training toward tenets/goals.
 */
export function exerciseFitnessGoal(exercise: Exercise, tenetName?: Map<string | number, string>): string {
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
  if (!primary?.phaseName && !exercise.primary_phase_key) return null
  if (primary?.phaseName) return `Programmed for ${primary.phaseName}`
  return exercise.primary_phase_key ? `Programmed for ${exercise.primary_phase_key.replace(/_/g, ' ')}` : null
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
