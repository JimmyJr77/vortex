import type { Exercise } from './types'

const TUMBLING_SUBROLES = new Set([
  'rotation_inversion_tumbling_foundations',
  'reactive_agility_tumbling_output',
])

/** Infer programming exercise compatibility types from exercise metadata. */
export function inferExerciseCompatibilityTypes(ex: Exercise): string[] {
  const types = new Set<string>()
  const family = (ex.movement_family ?? '').toLowerCase()
  const subrole = ex.phase_subrole ?? ''
  const phase = ex.primary_phase_key ?? ''

  if (TUMBLING_SUBROLES.has(subrole) || family.includes('tumbling') || family.includes('inversion')) {
    types.add('tumbling')
    types.add('advanced_skill')
  }
  if (phase === 'output' && (family.includes('sprint') || family.includes('plyo') || family.includes('jump'))) {
    types.add('sprint')
    types.add('high_impact_plyometrics')
  }
  if (family.includes('shuttle') || family.includes('cod')) types.add('shuttle')
  if (family.includes('carry')) types.add('carry')
  if (family.includes('crawl')) types.add('crawl')
  if (family.includes('rope') || family.includes('jump rope')) types.add('jump_rope')
  if (family.includes('med ball') || family.includes('medicine')) types.add('med_ball')
  if (family.includes('hang') || family.includes('pull') || family.includes('grip')) types.add('grip_hang')
  if (family.includes('machine') || family.includes('bike') || family.includes('row')) types.add('machine_cardio')
  if (family.includes('mobility') || phase === 'prepare_and_access') types.add('mobility_flow')
  if (family.includes('locomotion') || subrole === 'locomotion_sprint_mechanics') types.add('locomotion')
  if (family.includes('bodyweight') || phase === 'capacity') types.add('bodyweight_strength')
  if (family.includes('partner') || family.includes('relay')) types.add('partner_drill')
  if (family.includes('game')) types.add('game')
  if ((ex.movement_requirements?.impact_level ?? 0) >= 3) types.add('high_impact_plyometrics')
  if (types.size === 0) types.add('low_skill_calisthenics')
  return [...types]
}

export type ProgrammingExerciseFit = 'compatible' | 'conditional' | 'avoid' | 'unknown'

export function programmingExerciseFit(
  ex: Exercise,
  compat: { compatible?: string[]; avoid?: string[]; conditional?: string[] } | null | undefined,
): ProgrammingExerciseFit {
  if (!compat) return 'unknown'
  const types = inferExerciseCompatibilityTypes(ex)
  const avoid = compat.avoid ?? []
  const conditional = compat.conditional ?? []
  const compatible = compat.compatible ?? []
  if (types.some((t) => avoid.includes(t))) return 'avoid'
  if (types.some((t) => compatible.includes(t))) return 'compatible'
  if (types.some((t) => conditional.includes(t))) return 'conditional'
  if (compatible.length === 0 && avoid.length === 0) return 'unknown'
  return 'conditional'
}

export function parseExerciseCompatibility(method: { exercise_compatibility?: Record<string, unknown> } | null | undefined) {
  const ec = method?.exercise_compatibility ?? {}
  return {
    compatible: (ec.compatible_exercise_types as string[]) ?? [],
    avoid: (ec.avoid_exercise_types as string[]) ?? [],
    conditional: (ec.conditional_exercise_types as string[]) ?? [],
  }
}
