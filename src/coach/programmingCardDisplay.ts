import { phaseDisplayName } from './sessionPhaseKeys'

const EXERCISE_TYPE_LABELS: Record<string, string> = {
  locomotion: 'Locomotion',
  shuttle: 'Shuttle',
  sprint: 'Sprint',
  low_amplitude_elastic: 'Low-amplitude elastic',
  jump_rope: 'Jump rope',
  bodyweight_strength: 'Bodyweight strength',
  loaded_strength: 'Loaded strength',
  carry: 'Carry',
  crawl: 'Crawl',
  grip_hang: 'Grip / hang',
  med_ball: 'Medicine ball',
  low_skill_calisthenics: 'Low-skill calisthenics',
  machine_cardio: 'Machine cardio',
  mobility_flow: 'Mobility flow',
  partner_drill: 'Partner drill',
  game: 'Game',
  tumbling: 'Tumbling',
  advanced_skill: 'Advanced skill',
  high_impact_plyometrics: 'High-impact plyometrics',
  advanced_tumbling: 'Advanced tumbling',
  max_velocity_sprint: 'Max-velocity sprint',
  carries: 'Carries',
  crawls: 'Crawls',
}

const ENERGY_SYSTEM_LABELS: Record<string, string> = {
  aerobic: 'Aerobic',
  glycolytic: 'Glycolytic',
  alactic_repeat: 'Alactic repeat',
  mixed: 'Mixed',
  recovery: 'Recovery',
  local_muscular_endurance: 'Local muscular endurance',
  grip_endurance: 'Grip endurance',
  trunk_endurance: 'Trunk endurance',
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return []
  return val.map((v) => String(v).trim()).filter(Boolean)
}

function formatExerciseTypes(types: unknown): string[] {
  return asStringArray(types).map((t) => EXERCISE_TYPE_LABELS[t] ?? humanizeKey(t))
}

function formatPrescriptionLevel(data: Record<string, unknown>): string[] {
  const lines: string[] = []
  if (data.minutes != null) lines.push(`${data.minutes} min total`)
  if (data.rounds != null) lines.push(`${data.rounds} rounds`)
  if (data.work_target_seconds != null || data.work_seconds != null) {
    lines.push(`${data.work_target_seconds ?? data.work_seconds}s work`)
  }
  if (data.rest_target_seconds != null || data.rest_seconds != null) {
    lines.push(`${data.rest_target_seconds ?? data.rest_seconds}s rest`)
  }
  if (data.rpe != null) lines.push(`RPE ${data.rpe}`)
  if (data.default_total_minutes != null) lines.push(`${data.default_total_minutes} min total`)
  if (data.default_rounds != null) lines.push(`${data.default_rounds} rounds`)
  if (data.default_work_seconds != null) lines.push(`${data.default_work_seconds}s work`)
  if (data.default_rest_seconds != null) lines.push(`${data.default_rest_seconds}s rest`)
  if (data.default_rpe_min != null || data.default_rpe_max != null) {
    lines.push(`RPE ${data.default_rpe_min ?? '—'}–${data.default_rpe_max ?? '—'}`)
  }
  if (typeof data.notes === 'string' && data.notes.trim()) lines.push(data.notes.trim())
  return lines
}

export interface DisplayField {
  label: string
  value: string
}

export interface DisplaySection {
  title: string
  fields?: DisplayField[]
  bullets?: string[]
  paragraphs?: string[]
}

export function formatWorkRestStructure(structure: Record<string, unknown> | undefined | null): DisplaySection[] {
  if (!structure || Object.keys(structure).length === 0) return []

  const sections: DisplaySection[] = []
  const defaultRx = structure.default_prescription as Record<string, Record<string, unknown>> | undefined

  if (defaultRx && typeof defaultRx === 'object') {
    for (const [level, data] of Object.entries(defaultRx)) {
      const lines = formatPrescriptionLevel(data ?? {})
      if (lines.length > 0) {
        sections.push({
          title: `${humanizeKey(level)} prescription`,
          bullets: lines,
        })
      }
    }
  }

  const options = asStringArray(structure.work_rest_options)
  if (options.length > 0) {
    sections.push({ title: 'Work / rest options', bullets: options })
  }

  const durations = asStringArray(structure.typical_total_duration_minutes)
  if (durations.length > 0) {
    sections.push({
      title: 'Typical total duration',
      fields: [{ label: 'Minutes', value: durations.join(', ') }],
    })
  }

  if (typeof structure.recommended_density === 'string' && structure.recommended_density.trim()) {
    sections.push({
      title: 'Recommended density',
      paragraphs: [structure.recommended_density.trim()],
    })
  }
  if (typeof structure.pacing_notes === 'string' && structure.pacing_notes.trim()) {
    sections.push({
      title: 'Pacing notes',
      paragraphs: [structure.pacing_notes.trim()],
    })
  }

  return sections
}

export function formatExerciseCompatibility(compat: Record<string, unknown> | undefined | null): DisplaySection[] {
  if (!compat || Object.keys(compat).length === 0) return []

  const sections: DisplaySection[] = []
  const compatible = formatExerciseTypes(compat.compatible_exercise_types)
  const conditional = formatExerciseTypes(compat.conditional_exercise_types)
  const avoid = formatExerciseTypes(compat.avoid_exercise_types)

  if (compatible.length > 0) {
    sections.push({ title: 'Works well with', bullets: compatible })
  }
  if (conditional.length > 0) {
    sections.push({ title: 'Use with caution', bullets: conditional })
  }
  if (avoid.length > 0) {
    sections.push({ title: 'Avoid', bullets: avoid })
  }

  return sections
}

export function formatWorkoutBuilderRules(rules: Record<string, unknown> | undefined | null): DisplaySection[] {
  if (!rules || Object.keys(rules).length === 0) return []

  const defaults: DisplayField[] = []
  const requirements: DisplayField[] = []
  const other: DisplayField[] = []

  const phaseKeys = new Set(['preferred_session_phase', 'allowed_session_phases'])
  const defaultKeys = new Set([
    'default_duration_minutes',
    'default_rounds',
    'default_work_seconds',
    'default_rest_seconds',
    'default_cap_minutes',
    'default_rpe_range',
    'recommended_age_min',
  ])
  const requirementKeys = new Set([
    'requires_timer',
    'requires_stations',
    'requires_lanes',
    'requires_clear_runout',
    'requires_score_tracking',
    'group_friendly',
    'equipment_flexibility',
    'coaching_complexity',
  ])

  for (const [key, raw] of Object.entries(rules)) {
    if (key === 'safety_notes') continue
    let value = ''
    if (phaseKeys.has(key)) {
      if (Array.isArray(raw)) {
        value = raw.map((p) => phaseDisplayName(String(p))).join(', ')
      } else if (typeof raw === 'string') {
        value = phaseDisplayName(raw)
      }
    } else if (key === 'default_rpe_range' && Array.isArray(raw)) {
      value = raw.join('–')
    } else if (typeof raw === 'boolean') {
      value = raw ? 'Yes' : 'No'
    } else if (raw == null) {
      continue
    } else {
      value = String(raw)
    }

    const field = { label: humanizeKey(key), value }
    if (defaultKeys.has(key) || phaseKeys.has(key)) defaults.push(field)
    else if (requirementKeys.has(key)) requirements.push(field)
    else other.push(field)
  }

  const sections: DisplaySection[] = []
  if (defaults.length > 0) sections.push({ title: 'Default settings', fields: defaults })
  if (requirements.length > 0) sections.push({ title: 'Requirements & setup', fields: requirements })
  if (other.length > 0) sections.push({ title: 'Additional rules', fields: other })

  const safetyNotes = asStringArray(rules.safety_notes)
  if (safetyNotes.length > 0) {
    sections.push({ title: 'Safety notes', bullets: safetyNotes })
  }

  return sections
}

function formatExampleStation(station: Record<string, unknown>): string | null {
  const task = typeof station.task === 'string' ? station.task.trim() : null
  if (!task) return null
  const minute = typeof station.minute === 'string' ? station.minute.trim() : null
  return minute ? `${minute}: ${task}` : task
}

export function formatExampleImplementation(example: Record<string, unknown>): DisplaySection[] {
  const json = (example.exampleJson ?? example.example_json) as Record<string, unknown> | undefined
  if (!json || typeof json !== 'object') return []

  const sections: DisplaySection[] = []

  if (json.cap_minutes != null) {
    sections.push({
      title: 'Time cap',
      fields: [{ label: 'Duration', value: `${json.cap_minutes} minutes` }],
    })
  }
  if (json.rounds != null) {
    sections.push({
      title: 'Structure',
      fields: [{ label: 'Rounds', value: String(json.rounds) }],
    })
  }

  const stations = Array.isArray(json.stations) ? json.stations : []
  const stationLines = stations
    .map((s) => formatExampleStation(s as Record<string, unknown>))
    .filter((line): line is string => Boolean(line))
  if (stationLines.length > 0) {
    sections.push({ title: 'Stations', bullets: stationLines })
  }

  const tasks = asStringArray(json.tasks)
  if (tasks.length > 0) {
    sections.push({ title: 'Tasks', bullets: tasks })
  }

  if (typeof json.quality_standard === 'string' && json.quality_standard.trim()) {
    sections.push({
      title: 'Quality standard',
      paragraphs: [json.quality_standard.trim()],
    })
  }

  const knownKeys = new Set(['cap_minutes', 'rounds', 'stations', 'tasks', 'quality_standard'])
  const extraFields: DisplayField[] = []
  for (const [key, val] of Object.entries(json)) {
    if (knownKeys.has(key) || val == null) continue
    if (typeof val === 'object') continue
    extraFields.push({ label: humanizeKey(key), value: String(val) })
  }
  if (extraFields.length > 0) {
    sections.push({ title: 'Details', fields: extraFields })
  }

  return sections
}

export function formatFatigueProfile(profile: Record<string, unknown> | undefined | null): DisplayField[] {
  if (!profile || typeof profile !== 'object') return []
  return Object.entries(profile)
    .filter(([, val]) => val != null && String(val).trim() !== '')
    .map(([key, val]) => ({
      label: humanizeKey(key),
      value: typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val).replace(/_/g, ' '),
    }))
}

export function formatEnergySystems(systems: unknown): string[] {
  return asStringArray(systems).map((s) => ENERGY_SYSTEM_LABELS[s] ?? humanizeKey(s))
}

export function formatSeverity(severity: string | undefined): string {
  if (!severity) return ''
  return humanizeKey(severity)
}
