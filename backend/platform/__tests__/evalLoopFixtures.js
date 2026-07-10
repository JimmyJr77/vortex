import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SESSION_PHASE_ORDER } from '../phaseArchitect.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const goldenScenario = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../scripts/golden-prescription-scenario.json'), 'utf8'),
)
export const goldenBody = goldenScenario.body

export function loadMetricsCatalog() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../../docs/NEEDS_ENGINE_CATEGORY_METRICS.json'), 'utf8'),
  )
}

export function mockResult(overrides = {}) {
  return {
    work_mode: 'exercise',
    blocks: [],
    audience_profile: { ageMin: 8, ageMax: 14, sessionObjective: 'speed_priority' },
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: [],
      equipment_avoid: { sample_names: [], excluded_count: 0 },
      exercise_avoid: { excluded_count: 0 },
      body_region_avoid: { excluded_count: 0 },
    },
    age_fit_warnings: [],
    split_variant_warnings: [],
    ...overrides,
  }
}

export function goldenBlocksFromPlan(body = goldenBody) {
  let est = 0
  return body.phasePlan.map((row, i) => {
    est += row.minutes
    return {
      phase_key: row.phaseKey,
      label: row.label,
      target_minutes: row.minutes,
      estimated_minutes: row.minutes,
      fill_pct: 100,
      focus_targets: row.focusTargets ?? [],
      items: row.phaseKey === 'restore'
        ? [{ exercise_id: 100, exercise_name: 'Box Breathing', difficulty: { overall: 2 } }]
        : [{ exercise_id: i + 1, exercise_name: `Exercise ${i + 1}`, difficulty: { overall: 4 } }],
      index: i,
    }
  })
}

export function fullGoldenResult(overrides = {}) {
  const blocks = goldenBlocksFromPlan()
  return mockResult({
    blocks,
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: blocks.map((b) => ({
        phase_key: b.phase_key,
        fill_pct: 100,
        pool_size: 10,
        skipped_candidates: 1,
        split_rejects: 0,
      })),
      equipment_avoid: { sample_names: [], excluded_count: 1 },
      exercise_avoid: { excluded_count: 0 },
      body_region_avoid: { excluded_count: 0 },
    },
    ...overrides,
  })
}

export function checksFromEval(evalResult) {
  return evalResult.checks ?? []
}

export function makeShiftedC20Metric() {
  return {
    ID: 'C20-MOP-01',
    Metric: 'MOP',
    Prerequisites: 'No pool_empty reasons',
    'In app?': '`empty_phase_reasons`',
    check_id: 'yes',
    'Evaluable?': '`no_empty_phases`',
  }
}

export function scalePhasePlanToDuration(plan, targetDuration) {
  const sourceSum = plan.reduce((s, r) => s + Number(r.minutes ?? 0), 0)
  const scaled = plan.map((p) => ({
    ...p,
    minutes: Math.round(Number(p.minutes ?? 0) * (targetDuration / sourceSum)),
  }))
  const diff = targetDuration - scaled.reduce((s, p) => s + p.minutes, 0)
  if (diff !== 0 && scaled.length > 0) scaled[0].minutes += diff
  return scaled
}

export function buildExerciseContext(result) {
  const exerciseById = new Map()
  const tagMap = new Map()
  for (const block of result?.blocks ?? []) {
    for (const item of block.items ?? []) {
      const id = Number(item.exercise_id)
      if (id) {
        exerciseById.set(id, {
          id,
          slug: item.exercise_slug ?? `exercise-${id}`,
          name: item.exercise_name ?? `Exercise ${id}`,
          movement_family: 'general',
          programming_kind: item.programming_kind ?? 'exercise',
        })
        tagMap.set(String(id), [])
      }
      for (const v of item.per_split ?? []) {
        const vid = Number(v.exercise_id)
        if (vid) {
          exerciseById.set(vid, {
            id: vid,
            slug: `exercise-${vid}`,
            name: v.exercise_name ?? `Exercise ${vid}`,
            movement_family: 'general',
            programming_kind: 'exercise',
          })
          tagMap.set(String(vid), [])
        }
      }
    }
  }
  return { exerciseById, tagMap, equipmentKeyById: new Map() }
}
