import assert from 'node:assert/strict'
import test from 'node:test'
import {
  evaluatePrescriptionQuality,
  DEFAULT_STRICT_THRESHOLDS,
  DEFAULT_BASELINE_THRESHOLDS,
  sharesPatternOrFamily,
} from '../prescriptionQualityChecks.js'

function mockResult(overrides = {}) {
  return {
    blocks: [],
    audience_profile: { ageMax: 14 },
    constraint_report: { empty_phase_reasons: [], phase_fill: [], equipment_avoid: { sample_names: [] } },
    age_fit_warnings: [],
    split_variant_warnings: [],
    ...overrides,
  }
}

test('progression_reuse fails when same progression used twice in output', () => {
  const result = mockResult({
    blocks: [{
      phase_key: 'output',
      target_minutes: 40,
      estimated_minutes: 38,
      items: [{
        exercise_id: 1,
        exercise_name: 'Push-Up Start',
        difficulty: { overall: 4 },
        per_split: [
          { split_label: 'Split 1', variant_type: 'same', exercise_id: 1, difficulty: { overall: 4 } },
          { split_label: 'Split 2', variant_type: 'progression', exercise_id: 99, exercise_name: 'Hang Power Clean', difficulty: { overall: 7 } },
        ],
      }, {
        exercise_id: 2,
        exercise_name: 'Broad Jump',
        difficulty: { overall: 4 },
        per_split: [
          { split_label: 'Split 1', variant_type: 'same', exercise_id: 2, difficulty: { overall: 4 } },
          { split_label: 'Split 2', variant_type: 'progression', exercise_id: 99, exercise_name: 'Hang Power Clean', difficulty: { overall: 7 } },
        ],
      }],
    }],
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: [{ phase_key: 'output', fill_pct: 95 }],
      equipment_avoid: { sample_names: [] },
    },
  })

  const exerciseById = new Map([
    [1, { id: 1, slug: 'push-up-start', movement_family: 'sprint' }],
    [2, { id: 2, slug: 'broad-jump', movement_family: 'jump' }],
    [99, { id: 99, slug: 'hang-power-clean', movement_family: 'olympic' }],
  ])
  const tagMap = new Map([
    ['1', [{ facetType: 'pattern', facetId: 10 }]],
    ['2', [{ facetType: 'pattern', facetId: 11 }]],
    ['99', [{ facetType: 'pattern', facetId: 12 }]],
  ])

  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    tagMap,
    exerciseById,
    equipmentKeyById: new Map(),
    sessionAgeMax: 14,
  })

  assert.equal(evalResult.ok, false)
  assert.ok(evalResult.failed.some((f) => f.id === 'progression_reuse_output'))
})

test('progression_lane fails when pattern and family differ', () => {
  const result = mockResult({
    blocks: [{
      phase_key: 'output',
      items: [{
        exercise_id: 1,
        exercise_name: 'Push-Up Start',
        difficulty: { overall: 4 },
        per_split: [
          { split_label: 'Split 2', variant_type: 'progression', exercise_id: 99, exercise_name: 'Landmine Jerk', difficulty: { overall: 7 } },
        ],
      }],
    }],
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: [{ phase_key: 'output', fill_pct: 95 }],
      equipment_avoid: { sample_names: [] },
    },
  })

  const exerciseById = new Map([
    [1, { id: 1, movement_family: 'sprint' }],
    [99, { id: 99, movement_family: 'olympic' }],
  ])
  const tagMap = new Map([
    ['1', [{ facetType: 'pattern', facetId: 10 }]],
    ['99', [{ facetType: 'pattern', facetId: 99 }]],
  ])

  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    tagMap,
    exerciseById,
    sessionAgeMax: 14,
  })

  assert.ok(evalResult.failed.some((f) => f.id === 'progression_lane_output'))
})

test('sharesPatternOrFamily detects shared pattern', () => {
  const tagMap = new Map([
    ['1', [{ facetType: 'pattern', facetId: 5 }]],
    ['2', [{ facetType: 'pattern', facetId: 5 }]],
  ])
  assert.equal(sharesPatternOrFamily(1, 2, tagMap, new Map()), true)
})

test('baseline tier passes with minimal stretch rules', () => {
  const result = mockResult({
    blocks: [{
      phase_key: 'restore',
      target_minutes: 4,
      estimated_minutes: 4,
      items: [{ exercise_id: 1, exercise_name: 'Breathing' }],
    }],
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: [],
      equipment_avoid: { sample_names: [] },
    },
  })

  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_BASELINE_THRESHOLDS, { sessionAgeMax: 14 })
  assert.equal(evalResult.failed.some((f) => f.id === 'restore_non_empty'), false)
})
