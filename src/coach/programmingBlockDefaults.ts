import type { BlockFormat, ProgrammingMethod, WorkoutBlock } from './types'

const TYPE_TO_FORMAT: Record<string, BlockFormat> = {
  emom: 'emom',
  amrap: 'amrap',
  interval: 'interval',
  circuit: 'circuit',
  density: 'density',
  tempo: 'tempo',
  relay: 'relay',
  game: 'game',
  timed_work_capacity: 'for_time',
  repeat_sprint: 'for_time',
  repeat_shuttle: 'for_time',
  zone2: 'interval',
  hiit: 'circuit',
  custom: 'straight_sets',
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Apply programming method defaults onto a workout block draft. */
export function applyProgrammingMethodDefaults(method: ProgrammingMethod, block: WorkoutBlock): Partial<WorkoutBlock> {
  const wbr = (method.workout_builder_rules ?? {}) as Record<string, unknown>
  const rx = method.prescriptions?.find((p) => p.profile_name === 'intermediate') ?? method.prescriptions?.[0]
  const qualityStandards = (method.quality_standards ?? [])
    .filter((q) => q.severity === 'required' || q.severity === 'error')
    .map((q) => q.standard)
  const stopRules = (method.stop_rules ?? []).map((s) => s.stopRule)

  const programmingType = method.programming_type ?? 'custom'
  const blockFormat = TYPE_TO_FORMAT[programmingType] ?? block.block_format

  return {
    programming_method_id: method.id,
    programming_method_slug: method.slug,
    programming_method_name: method.name,
    block_format: blockFormat,
    rounds: num(rx?.default_rounds ?? wbr.default_rounds) ?? block.rounds,
    work_seconds: num(rx?.default_work_seconds ?? wbr.default_work_seconds),
    rest_seconds: num(rx?.default_rest_seconds ?? wbr.default_rest_seconds),
    rest_between_rounds_seconds: num(rx?.default_rest_between_rounds_seconds) ?? block.rest_between_rounds_seconds,
    cap_minutes: num(rx?.default_cap_minutes ?? wbr.default_cap_minutes),
    minutes_budget: num(rx?.default_total_minutes ?? wbr.default_duration_minutes) ?? block.minutes_budget,
    station_count: num(wbr.default_station_count),
    density_target: typeof wbr.default_density_target === 'string' ? wbr.default_density_target : null,
    scoring_mode: wbr.requires_score_tracking ? 'rounds' : 'none',
    quality_standard: qualityStandards.slice(0, 3).join('; ') || null,
    stop_rules_json: stopRules.slice(0, 5),
  }
}
