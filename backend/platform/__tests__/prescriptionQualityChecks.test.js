import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  evaluatePrescriptionQuality,
  evaluateCategory1Structure,
  validatePrescribeBodyMOS,
  computeCategory1Kpi,
  CATEGORY1_KPI_CHECK_IDS,
  CATEGORY1_MOE_CHECK_IDS,
  DEFAULT_STRICT_THRESHOLDS,
  DEFAULT_BASELINE_THRESHOLDS,
  sharesPatternOrFamily,
} from '../prescriptionQualityChecks.js'
import {
  evaluateCategory3Restore,
  CATEGORY3_KPI_CHECK_IDS,
  CATEGORY3_MOE_CHECK_IDS,
  computeCategory3Kpi,
  evaluateCategory4Audience,
  CATEGORY4_KPI_CHECK_IDS,
  CATEGORY4_MOE_CHECK_IDS,
  computeCategory4Kpi,
  evaluateCategory2Fill,
  CATEGORY2_KPI_CHECK_IDS,
  CATEGORY2_MOE_CHECK_IDS,
  computeCategory2Kpi,
} from '../categoryQualityEvaluators.js'
import {
  evaluateCategory5Splits,
  CATEGORY5_KPI_CHECK_IDS,
  CATEGORY5_MOE_CHECK_IDS,
  computeCategory5Kpi,
  evaluateCategory6Progressions,
  CATEGORY6_KPI_CHECK_IDS,
  CATEGORY6_MOE_CHECK_IDS,
  computeCategory6Kpi,
  evaluateCategory7Lane,
  CATEGORY7_KPI_CHECK_IDS,
  CATEGORY7_MOE_CHECK_IDS,
  computeCategory7Kpi,
  evaluateCategory8Reuse,
  CATEGORY8_KPI_CHECK_IDS,
  CATEGORY8_MOE_CHECK_IDS,
  computeCategory8Kpi,
  evaluateCategory9Climb,
  CATEGORY9_KPI_CHECK_IDS,
  CATEGORY9_MOE_CHECK_IDS,
  computeCategory9Kpi,
  evaluateCategory10AgeFit,
  CATEGORY10_KPI_CHECK_IDS,
  CATEGORY10_MOE_CHECK_IDS,
  computeCategory10Kpi,
  evaluateCategory11CapUtil,
  CATEGORY11_KPI_CHECK_IDS,
  CATEGORY11_UTIL_CHECK_IDS,
  CATEGORY11_MOE_CHECK_IDS,
  computeCategory11Kpi,
  evaluateCategory12EquipUse,
  CATEGORY12_KPI_CHECK_IDS,
  CATEGORY12_MOE_CHECK_IDS,
  computeCategory12Kpi,
  evaluateCategory13EquipAvoid,
  CATEGORY13_KPI_CHECK_IDS,
  CATEGORY13_MOE_CHECK_IDS,
  computeCategory13Kpi,
  evaluateCategory14MovementAvoid,
  CATEGORY14_KPI_CHECK_IDS,
  CATEGORY14_MOE_CHECK_IDS,
  computeCategory14Kpi,
  evaluateCategory15Intent,
  CATEGORY15_KPI_CHECK_IDS,
  CATEGORY15_MOE_CHECK_IDS,
  computeCategory15Kpi,
  evaluateCategory16PhasePrimaries,
  CATEGORY16_KPI_CHECK_IDS,
  CATEGORY16_MOE_CHECK_IDS,
  computeCategory16Kpi,
  evaluateCategory17Youth,
  CATEGORY17_KPI_CHECK_IDS,
  CATEGORY17_MOE_CHECK_IDS,
  computeCategory17Kpi,
  evaluateCategory18Stretch,
  CATEGORY18_KPI_CHECK_IDS,
  CATEGORY18_MOE_CHECK_IDS,
  computeCategory18Kpi,
  evaluateCategory19Diversity,
  CATEGORY19_KPI_CHECK_IDS,
  CATEGORY19_MOE_CHECK_IDS,
  computeCategory19Kpi,
  evaluateCategory24Format,
  CATEGORY24_KPI_CHECK_IDS,
  CATEGORY24_MOE_CHECK_IDS,
  computeCategory24Kpi,
  evaluateCategory20Constraint,
  CATEGORY20_KPI_CHECK_IDS,
  CATEGORY20_MOE_CHECK_IDS,
  computeCategory20Kpi,
  evaluateCategory21Warnings,
  CATEGORY21_KPI_CHECK_IDS,
  CATEGORY21_MOE_CHECK_IDS,
  computeCategory21Kpi,
  evaluateCategory22Feasibility,
  CATEGORY22_KPI_CHECK_IDS,
  CATEGORY22_MOE_CHECK_IDS,
  computeCategory22Kpi,
  evaluateCategory23Sport,
  CATEGORY23_KPI_CHECK_IDS,
  CATEGORY23_MOE_CHECK_IDS,
  computeCategory23Kpi,
  evaluateCategory25Library,
  CATEGORY25_KPI_CHECK_IDS,
  CATEGORY25_MOE_CHECK_IDS,
  computeCategory25Kpi,
  PRESCRIPTION_ERROR_CODES,
} from '../categoryEvaluatorsExtended.js'
import { computeLaneStability, computeFillStability, computeChronicUnderfill, computeAgeFitWarningStability, computeCapUtilStability, computeStretchVariantWarningStability, computePoolEmptyStability, computeSplitRejectChronic, computeGoldenFeasibilityStability, computeWarningPairStability, computeWarningCleanStreak, computeDoseStability, computeReuseStability, computeHiitFallbackChronic } from '../evalHistory.js'
import { isPhaseAdjacent } from '../progressionLanePolicy.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const goldenBody = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../scripts/golden-prescription-scenario.json'), 'utf8'),
).body
const goldenScenario = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../scripts/golden-prescription-scenario.json'), 'utf8'),
)
const goldenSnapshot = goldenScenario.snapshot ?? goldenScenario.requirements ?? null

function goldenBlocksFromPlan(body = goldenBody) {
  return body.phasePlan.map((row) => ({
    phase_key: row.phaseKey,
    label: row.label,
    target_minutes: row.minutes,
    focus_targets: row.focusTargets ?? [],
    other_kind: row.otherKind,
  }))
}

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

test('validatePrescribeBodyMOS passes Test 3 golden body', () => {
  const mos = validatePrescribeBodyMOS(goldenBody)
  assert.equal(mos.ok, true)
  assert.ok(mos.checks.some((c) => c.id === 'prescribe_body_mos_complete' && c.ok))
  assert.ok(mos.checks.some((c) => c.id === 'phase_plan_minute_sum_mos' && c.ok))
})

test('validatePrescribeBodyMOS fails when phasePlan minutes do not sum to duration', () => {
  const bad = {
    ...goldenBody,
    phasePlan: goldenBody.phasePlan.map((r, i) => (i === 0 ? { ...r, minutes: 99 } : r)),
  }
  const mos = validatePrescribeBodyMOS(bad)
  assert.equal(mos.ok, false)
  assert.ok(mos.checks.some((c) => c.id === 'phase_plan_minute_sum_mos' && !c.ok))
})

test('evaluateCategory1Structure passes when blocks mirror golden phasePlan', () => {
  const checks = []
  const result = {
    blocks: goldenBlocksFromPlan(),
    work_mode: 'exercise',
    audience_profile: { sessionObjective: 'speed_priority' },
    phase_rationales: goldenBody.phasePlan.map((r) => ({ phase_key: r.phaseKey, phase_rationale: null })),
  }
  evaluateCategory1Structure(result, goldenBody, checks)
  const failed = checks.filter((c) => !c.ok)
  assert.equal(failed.length, 0, failed.map((f) => f.id).join(', '))
})

test('evaluateCategory1Structure fails on phase minutes mismatch', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan()
  blocks[2].target_minutes = 39
  const result = {
    blocks,
    work_mode: 'exercise',
    audience_profile: { sessionObjective: 'speed_priority' },
    phase_rationales: blocks.map((b) => ({ phase_key: b.phase_key })),
  }
  evaluateCategory1Structure(result, goldenBody, checks)
  assert.ok(checks.some((c) => c.id === 'phase_minutes_exact' && !c.ok))
})

test('evaluateCategory1Structure fails on canonical order inversion', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan()
  ;[blocks[0], blocks[1]] = [blocks[1], blocks[0]]
  const result = {
    blocks,
    work_mode: 'exercise',
    audience_profile: { sessionObjective: 'speed_priority' },
    phase_rationales: blocks.map((b) => ({ phase_key: b.phase_key })),
  }
  evaluateCategory1Structure(result, goldenBody, checks)
  assert.ok(checks.some((c) => c.id === 'canonical_phase_order' && !c.ok))
})

test('evaluateCategory1Structure fails block_index_order when block indices are permuted', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan()
  ;[blocks[2], blocks[3]] = [blocks[3], blocks[2]]
  const result = {
    blocks,
    work_mode: 'exercise',
    audience_profile: { sessionObjective: 'speed_priority' },
    phase_rationales: blocks.map((b) => ({ phase_key: b.phase_key })),
  }
  evaluateCategory1Structure(result, goldenBody, checks)
  assert.ok(checks.some((c) => c.id === 'block_index_order' && !c.ok))
})

test('computeCategory1Kpi aggregates structure check pass rate', () => {
  const checks = CATEGORY1_KPI_CHECK_IDS.map((id, i) => ({
    id,
    ok: i < CATEGORY1_KPI_CHECK_IDS.length - 2,
    message: 'test',
  }))
  const kpi = computeCategory1Kpi(checks, { minRate: 0.95 })
  assert.equal(kpi.ok, false)
  assert.ok(kpi.detail.rate < 0.95)
})

test('evaluatePrescriptionQuality runs category1 checks when expectedBody provided', () => {
  const result = mockResult({
    blocks: goldenBlocksFromPlan(),
    work_mode: 'exercise',
    audience_profile: { sessionObjective: 'speed_priority', ageMax: 14 },
    phase_rationales: goldenBody.phasePlan.map((r) => ({ phase_key: r.phaseKey })),
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: goldenBody.phasePlan.map((r) => ({ phase_key: r.phaseKey, fill_pct: 95 })),
      equipment_avoid: { sample_names: [] },
    },
  })
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_BASELINE_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
  })
  assert.ok(evalResult.checks.some((c) => c.id === 'phase_count_match'))
  assert.ok(evalResult.checks.some((c) => c.id === 'category1_kpi'))
  for (const id of CATEGORY1_MOE_CHECK_IDS) {
    assert.ok(evalResult.checks.some((c) => c.id === id), `missing Category 1 MOE: ${id}`)
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'block_index_order'))
  assert.ok(evalResult.checks.some((c) => c.id === 'category2_kpi'))
  for (const id of CATEGORY2_MOE_CHECK_IDS) {
    assert.ok(evalResult.checks.some((c) => c.id === id), `missing Category 2 MOE: ${id}`)
  }
  assert.ok(!evalResult.checks.some((c) => c.id === 'category2_tbd_backfill'))
  assert.ok(evalResult.checks.some((c) => c.id === 'phase_fill_coverage'))
  assert.ok(evalResult.checks.some((c) => c.id === 'category3_kpi'))
  assert.ok(evalResult.checks.some((c) => c.id === 'restore_block_last'))
  assert.ok(evalResult.checks.some((c) => c.id === 'category4_kpi'))
  assert.ok(evalResult.checks.some((c) => c.id === 'category5_kpi'))
  assert.ok(evalResult.checks.some((c) => c.id === 'category25_kpi'))
  assert.ok(evalResult.checks.some((c) => c.id === 'audience_age_range'))
  const cat2Kpi = evalResult.checks.find((c) => c.id === 'category2_kpi')
  assert.ok(cat2Kpi)
  assert.equal(cat2Kpi.detail?.informational, undefined)
})

function mockGoldenResultWithRestore(overrides = {}) {
  const blocks = goldenBlocksFromPlan().map((b) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    items: b.phase_key === 'restore'
      ? [
          { exercise_id: 1, exercise_name: 'Box Breathing Hold', difficulty: { overall: 2 }, sets: 1, work_seconds: 30 },
          { exercise_id: 2, exercise_name: 'Cat Cow', difficulty: { overall: 2 }, sets: 1, work_seconds: 30 },
        ]
      : b.phase_key === 'sustained_capacity'
        ? [{ exercise_id: 3, exercise_name: 'HIIT Circuit', difficulty: { overall: 5 }, sets: 2, work_seconds: 30 }]
        : [],
    focus_targets: b.phase_key === 'sustained_capacity'
      ? [{ facetType: 'methodology', facetId: 1169, weight: 5 }]
      : (b.focus_targets ?? []),
  }))
  return mockResult({
    blocks,
    work_mode: 'exercise',
    audience_profile: { sessionObjective: 'speed_priority', ageMax: 14, caps: { maxOverall: 6 } },
    phase_rationales: goldenBody.phasePlan.map((r) => ({ phase_key: r.phaseKey })),
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: goldenBody.phasePlan.map((r) => ({ phase_key: r.phaseKey, fill_pct: 100 })),
      equipment_avoid: { sample_names: [] },
    },
    ...overrides,
  })
}

test('all CATEGORY3_KPI_CHECK_IDS present when expectedBody provided', () => {
  const result = mockGoldenResultWithRestore()
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById: new Map([
      [1, { id: 1, slug: 'box-breathing-hold', primary_phase_key: 'restore' }],
      [2, { id: 2, slug: 'cat-cow', primary_phase_key: 'restore' }],
      [3, { id: 3, slug: 'hiit-circuit', primary_phase_key: 'sustained_capacity' }],
    ]),
    tagMap: new Map(),
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map([[1169, 'hiit']]),
    expandedAvoidEquipIds: new Set([3]),
    equipmentAvoidKeys: ['plyo_box'],
  })
  for (const id of CATEGORY3_KPI_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 3 KPI check id: ${id}`,
    )
  }
  for (const id of CATEGORY3_MOE_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 3 MOE check id: ${id}`,
    )
  }
  assert.ok(!evalResult.checks.some((c) => c.id === 'category3_tbd_arousal'))
})

test('evaluateCategory3Restore fails restore_block_last when restore is not last block', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    items: b.phase_key === 'restore'
      ? [
          { exercise_id: 1, exercise_name: 'Breathing', difficulty: { overall: 2 } },
          { exercise_id: 2, exercise_name: 'Mobility', difficulty: { overall: 2 } },
        ]
      : [],
  }))
  const last = blocks.length - 1
  ;[blocks[last - 1], blocks[last]] = [blocks[last], blocks[last - 1]]
  const result = {
    blocks,
    audience_profile: { ageMax: 14, caps: { maxOverall: 6 } },
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: [],
      equipment_avoid: { sample_names: [] },
    },
  }
  evaluateCategory3Restore(result, goldenBody, checks, {})
  const positionCheck = checks.find((c) => c.id === 'restore_block_last')
  assert.ok(positionCheck)
  assert.equal(positionCheck.ok, false)
})

test('evaluateCategory3Restore fails category3_moe_arousal_downshift when high-arousal slug present', () => {
  const checks = []
  const result = mockGoldenResultWithRestore({
    blocks: goldenBlocksFromPlan().map((b) => ({
      ...b,
      estimated_minutes: b.target_minutes,
      items: b.phase_key === 'restore'
        ? [
            { exercise_id: 1, exercise_name: 'Plyo Box Jump', difficulty: { overall: 3 }, sets: 2, work_seconds: 30 },
            { exercise_id: 2, exercise_name: 'Cat Cow', difficulty: { overall: 2 }, sets: 1, work_seconds: 30 },
          ]
        : b.phase_key === 'sustained_capacity'
          ? [{ exercise_id: 3, exercise_name: 'HIIT Circuit', difficulty: { overall: 5 }, sets: 2, work_seconds: 30 }]
          : [],
      focus_targets: b.phase_key === 'sustained_capacity'
        ? [{ facetType: 'methodology', facetId: 1169, weight: 5 }]
        : (b.focus_targets ?? []),
    })),
  })
  evaluateCategory3Restore(result, goldenBody, checks, {
    exerciseById: new Map([
      [1, { id: 1, slug: 'plyo-box-jump', primary_phase_key: 'output' }],
      [2, { id: 2, slug: 'cat-cow', primary_phase_key: 'restore' }],
      [3, { id: 3, slug: 'hiit-circuit', primary_phase_key: 'sustained_capacity' }],
    ]),
    tagMap: new Map(),
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map([[1169, 'hiit']]),
  })
  const arousal = checks.find((c) => c.id === 'category3_moe_arousal_downshift')
  assert.ok(arousal)
  assert.equal(arousal.detail?.ok_band, false)
})

test('computeCategory3Kpi aggregates restore check pass rate', () => {
  const checks = CATEGORY3_KPI_CHECK_IDS.map((id, i) => ({
    id,
    ok: i < CATEGORY3_KPI_CHECK_IDS.length - 1,
    message: 'test',
  }))
  const kpi = computeCategory3Kpi(checks, { minRate: 0.95 })
  assert.equal(kpi.ok, false)
  assert.ok(kpi.detail.rate < 0.95)
})

const GOLDEN_AUDIENCE_SPLITS = [
  { label: 'Split 1', age_min: 8, age_max: 10, caps: { maxOverall: 6, maxTechnical: 6, maxLoad: 6 } },
  { label: 'Split 2', age_min: 11, age_max: 14, caps: { maxOverall: 10, maxTechnical: 10, maxLoad: 10 } },
]

function splitProgressionItem(primaryId, progId, split1D = 4, split2D = 7) {
  return {
    exercise_id: primaryId,
    exercise_name: `Primary ${primaryId}`,
    difficulty: { overall: split1D },
    per_split: [
      {
        split_label: 'Split 1',
        variant_type: 'same',
        exercise_id: primaryId,
        difficulty: { overall: split1D },
        difficulty_cap: 6,
        scaling_guidance: 'Use lighter load for younger athletes',
      },
      {
        split_label: 'Split 2',
        variant_type: 'progression',
        exercise_id: progId,
        exercise_name: `Progression ${progId}`,
        difficulty: { overall: split2D },
        difficulty_cap: 10,
        scaling_guidance: 'Use full load for older athletes',
      },
    ],
  }
}

function mockGoldenSplitsPrescription(overrides = {}) {
  const blocks = goldenBlocksFromPlan().map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'output') {
      base.items = [
        splitProgressionItem(10, 101),
        splitProgressionItem(11, 102),
        splitProgressionItem(12, 103),
      ]
    } else if (b.phase_key === 'capacity') {
      base.items = [splitProgressionItem(20, 201), splitProgressionItem(21, 202)]
    } else if (b.phase_key === 'resilience') {
      base.items = [splitProgressionItem(30, 301)]
    }
    return base
  })
  return mockResult({
    audience_splits: GOLDEN_AUDIENCE_SPLITS,
    split_variant_warnings: [],
    blocks,
    work_mode: 'exercise',
    audience_profile: { sessionObjective: 'speed_priority', ageMax: 14 },
    phase_rationales: goldenBody.phasePlan.map((r) => ({ phase_key: r.phaseKey })),
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: goldenBody.phasePlan.map((r) => ({
        phase_key: r.phaseKey,
        fill_pct: 100,
        pool_size: 10,
        split_rejects: 0,
        progression_eligible: ['output', 'capacity', 'resilience'].includes(r.phaseKey) ? 3 : 0,
        progression_assigned: ['output', 'capacity', 'resilience'].includes(r.phaseKey) ? 3 : 0,
        progression_coverage: ['output', 'capacity', 'resilience'].includes(r.phaseKey) ? 1 : null,
        phase_progression_ids: r.phaseKey === 'output' ? [101, 102, 103] : r.phaseKey === 'capacity' ? [201, 202] : r.phaseKey === 'resilience' ? [301] : [],
      })),
      equipment_avoid: { sample_names: [] },
    },
    ...overrides,
  })
}

test('all CATEGORY5_KPI_CHECK_IDS present when splits active', () => {
  const result = mockGoldenSplitsPrescription()
  const exerciseById = new Map()
  for (const id of [10, 11, 12, 20, 21, 30, 101, 102, 103, 201, 202, 301]) {
    exerciseById.set(id, { id, slug: `ex-${id}`, movement_family: 'sprint' })
  }
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById,
    tagMap: new Map(),
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map(),
    scalingProfileByExerciseId: new Map(),
  })
  for (const id of CATEGORY5_KPI_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 5 KPI check id: ${id}`,
    )
  }
  for (const id of CATEGORY5_MOE_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 5 MOE check id: ${id}`,
    )
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category5_kpi'))
  assert.ok(evalResult.checks.some((c) => c.id === 'per_split_completeness'))
  assert.ok(evalResult.checks.some((c) => c.id === 'split1_no_progressions'))
})

test('evaluateCategory5Splits fails audience_split_count_parity on split count mismatch', () => {
  const checks = []
  const result = mockGoldenSplitsPrescription({
    audience_splits: [GOLDEN_AUDIENCE_SPLITS[0]],
  })
  evaluateCategory5Splits(result, goldenBody, checks, {})
  const parity = checks.find((c) => c.id === 'audience_split_count_parity')
  assert.ok(parity)
  assert.equal(parity.ok, false)
  const kpi = computeCategory5Kpi([...checks, parity])
  assert.equal(kpi.ok, false)
})

test('all CATEGORY4_KPI_CHECK_IDS present when expectedBody provided', () => {
  const result = mockGoldenSplitsPrescription({
    audience_profile: {
      ageMin: 8,
      ageMax: 14,
      sessionObjective: 'speed_priority',
      impliedSkillLevel: 'INTERMEDIATE',
      scalingCohort: 'youth_intermediate',
      strengthIntent: false,
      ageBandLabel: 'ages 8-14',
      hardDifficultyExclude: true,
      caps: { maxOverall: 6, maxTechnical: 6, maxLoad: 5, maxComplexity: 6 },
    },
    age_fit_warnings: [],
  })
  const exerciseById = new Map()
  for (const id of [10, 11, 12, 20, 21, 30, 101, 102, 103, 201, 202, 301]) {
    exerciseById.set(id, { id, slug: `ex-${id}`, movement_family: 'sprint', skill_level: 'INTERMEDIATE' })
  }
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById,
    tagMap: new Map(),
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map(),
    difficultyByExerciseId: new Map(
      [10, 11, 12, 20, 21, 30].map((id) => [String(id), { recommended_age_min: 8, recommended_age_max: 14 }]),
    ),
    scalingProfileByExerciseId: new Map(),
  })
  for (const id of CATEGORY4_KPI_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 4 KPI check id: ${id}`,
    )
  }
  for (const id of CATEGORY4_MOE_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 4 MOE check id: ${id}`,
    )
  }
  assert.ok(!evalResult.checks.some((c) => c.id === 'category4_tbd_max_complexity'))
  assert.ok(!evalResult.checks.some((c) => c.id === 'category4_tbd_pool_filter'))
  assert.ok(evalResult.checks.some((c) => c.id === 'category4_kpi'))
})

test('evaluateCategory4Audience fails audience_hard_difficulty_exclude when flag missing', () => {
  const checks = []
  const result = mockGoldenSplitsPrescription({
    audience_profile: {
      ageMin: 8,
      ageMax: 14,
      caps: { maxOverall: 6, maxTechnical: 6, maxLoad: 5, maxComplexity: 6 },
      hardDifficultyExclude: false,
    },
  })
  evaluateCategory4Audience(result, goldenBody, checks, {})
  const hardCheck = checks.find((c) => c.id === 'audience_hard_difficulty_exclude')
  assert.ok(hardCheck)
  assert.equal(hardCheck.ok, false)
})

test('evaluateCategory4Audience fails audience_age_range on profile mismatch', () => {
  const checks = []
  const result = mockGoldenSplitsPrescription({
    audience_profile: { ageMin: 8, ageMax: 12, caps: { maxOverall: 6, maxTechnical: 6, maxLoad: 6 } },
  })
  evaluateCategory4Audience(result, goldenBody, checks, {})
  const ageCheck = checks.find((c) => c.id === 'audience_age_range')
  assert.ok(ageCheck)
  assert.equal(ageCheck.ok, false)
  const kpi = computeCategory4Kpi([...checks])
  assert.equal(kpi.ok, false)
})

test('all CATEGORY6_KPI_CHECK_IDS present when splits active', () => {
  const result = mockGoldenSplitsPrescription()
  const exerciseById = new Map()
  for (const id of [10, 11, 12, 20, 21, 30, 101, 102, 103, 201, 202, 301]) {
    exerciseById.set(id, { id, slug: `ex-${id}`, movement_family: 'sprint' })
  }
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById,
    tagMap: new Map(),
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map(),
    scalingProfileByExerciseId: new Map(),
  })
  for (const id of CATEGORY6_KPI_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 6 KPI check id: ${id}`,
    )
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category6_kpi'))
  for (const id of CATEGORY6_MOE_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 6 MOE check id: ${id}`,
    )
  }
})

test('evaluateCategory6Progressions fails progression_good_fit_only when progression on ineligible primary', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'output') {
      base.items = [{
        exercise_id: 10,
        exercise_name: 'Primary 10',
        difficulty: { overall: 9 },
        per_split: [
          { split_label: 'Split 1', variant_type: 'same', exercise_id: 10, difficulty: { overall: 4 }, difficulty_cap: 6 },
          { split_label: 'Split 2', variant_type: 'progression', exercise_id: 101, difficulty: { overall: 10 }, difficulty_cap: 10, scaling_guidance: 'Full' },
        ],
      }]
    }
    return base
  })
  const result = mockGoldenSplitsPrescription({ blocks })
  evaluateCategory6Progressions(result, goldenBody, checks, { exerciseById: new Map() })
  const goodFit = checks.find((c) => c.id === 'progression_good_fit_only')
  assert.ok(goodFit)
  assert.equal(goodFit.ok, false)
})

test('all CATEGORY7_KPI_CHECK_IDS present when splits active', () => {
  const result = mockGoldenSplitsPrescription()
  const exerciseById = new Map()
  for (const id of [10, 11, 12, 20, 21, 30, 101, 102, 103, 201, 202, 301]) {
    exerciseById.set(id, { id, slug: `ex-${id}`, movement_family: 'sprint' })
  }
  const tagMap = new Map()
  for (const id of [10, 11, 12, 20, 21, 30, 101, 102, 103, 201, 202, 301]) {
    tagMap.set(String(id), [{ facetType: 'pattern', facetId: 1, weight: 1 }])
  }
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById,
    tagMap,
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map(),
    tenetKeyById: new Map([[3, 'speed']]),
    scalingProfileByExerciseId: new Map(),
    difficultyByExerciseId: new Map(),
    progressionGraphEdges: new Map([[10, new Set([101])]]),
    thresholds: DEFAULT_STRICT_THRESHOLDS,
  })
  for (const id of CATEGORY7_KPI_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 7 KPI check id: ${id}`,
    )
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category7_kpi'))
  for (const id of CATEGORY7_MOE_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 7 MOE check id: ${id}`,
    )
  }
})

test('evaluateCategory7Lane fails progression_lane_family_fallback when families differ', () => {
  const checks = []
  const tagMap = new Map([
    ['10', [{ facetType: 'pattern', facetId: 1, weight: 1 }]],
    ['101', [{ facetType: 'pattern', facetId: 2, weight: 1 }]],
  ])
  const exerciseById = new Map([
    [10, { id: 10, movement_family: 'sprint' }],
    [101, { id: 101, movement_family: 'olympic_lift' }],
  ])
  const blocks = goldenBlocksFromPlan().map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'output') {
      base.items = [{
        exercise_id: 10,
        exercise_name: 'Primary',
        difficulty: { overall: 4 },
        per_split: [
          { split_label: 'Split 1', variant_type: 'same', exercise_id: 10, difficulty: { overall: 4 } },
          { split_label: 'Split 2', variant_type: 'progression', exercise_id: 101, exercise_name: 'Bad Prog', difficulty: { overall: 7 } },
        ],
      }]
    }
    return base
  })
  const result = mockGoldenSplitsPrescription({ blocks })
  evaluateCategory7Lane(result, goldenBody, checks, { tagMap, exerciseById, thresholds: {} })
  const lane = checks.find((c) => c.id === 'progression_lane_output')
  assert.ok(lane)
  assert.equal(lane.ok, false)
})

test('evaluateCategory7Lane fails progression_graph_edge_rate when graph missing edge', () => {
  const checks = []
  const tagMap = new Map([
    ['10', [{ facetType: 'pattern', facetId: 1, weight: 1 }]],
    ['101', [{ facetType: 'pattern', facetId: 1, weight: 1 }]],
  ])
  const exerciseById = new Map([
    [10, { id: 10, movement_family: 'sprint', primary_phase_key: 'output' }],
    [101, { id: 101, movement_family: 'sprint', primary_phase_key: 'output' }],
  ])
  const blocks = goldenBlocksFromPlan().map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'output') {
      base.items = [{
        exercise_id: 10,
        exercise_name: 'Primary',
        difficulty: { overall: 4 },
        per_split: [
          { split_label: 'Split 1', variant_type: 'same', exercise_id: 10, difficulty: { overall: 4 } },
          { split_label: 'Split 2', variant_type: 'progression', exercise_id: 101, difficulty: { overall: 7 } },
        ],
      }]
    }
    return base
  })
  const result = mockGoldenSplitsPrescription({ blocks })
  evaluateCategory7Lane(result, goldenBody, checks, {
    tagMap,
    exerciseById,
    progressionGraphEdges: new Map([[10, new Set([999])]]),
    thresholds: { minGraphEdgeRate: 0.7 },
  })
  const graph = checks.find((c) => c.id === 'progression_graph_edge_rate')
  assert.ok(graph)
  assert.equal(graph.ok, false)
})

test('evaluateCategory7Lane fails progression_lane_phase_adjacency for distant phases', () => {
  const checks = []
  const tagMap = new Map([
    ['10', [{ facetType: 'pattern', facetId: 1, weight: 1 }]],
    ['101', [{ facetType: 'pattern', facetId: 1, weight: 1 }]],
  ])
  const exerciseById = new Map([
    [10, { id: 10, movement_family: 'sprint', primary_phase_key: 'output' }],
    [101, { id: 101, movement_family: 'sprint', primary_phase_key: 'restore' }],
  ])
  const blocks = goldenBlocksFromPlan().map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'output') {
      base.items = [{
        exercise_id: 10,
        exercise_name: 'Primary',
        difficulty: { overall: 4 },
        per_split: [
          { split_label: 'Split 1', variant_type: 'same', exercise_id: 10, difficulty: { overall: 4 } },
          { split_label: 'Split 2', variant_type: 'progression', exercise_id: 101, difficulty: { overall: 7 } },
        ],
      }]
    }
    return base
  })
  const result = mockGoldenSplitsPrescription({ blocks })
  evaluateCategory7Lane(result, goldenBody, checks, { tagMap, exerciseById, thresholds: {} })
  const adj = checks.find((c) => c.id === 'progression_lane_phase_adjacency')
  assert.ok(adj)
  assert.equal(adj.ok, false)
})

test('evaluateCategory7Lane fails progression_youth_age_fit when recommended_age_min exceeds session', () => {
  const checks = []
  const tagMap = new Map([
    ['10', [{ facetType: 'pattern', facetId: 1, weight: 1 }]],
    ['101', [{ facetType: 'pattern', facetId: 1, weight: 1 }]],
  ])
  const exerciseById = new Map([
    [10, { id: 10, movement_family: 'sprint', primary_phase_key: 'output' }],
    [101, { id: 101, movement_family: 'sprint', primary_phase_key: 'output' }],
  ])
  const difficultyByExerciseId = new Map([
    ['101', { recommended_age_min: 16, recommended_age_max: 99 }],
  ])
  const blocks = goldenBlocksFromPlan().map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'output') {
      base.items = [{
        exercise_id: 10,
        exercise_name: 'Primary',
        difficulty: { overall: 4 },
        per_split: [
          { split_label: 'Split 1', variant_type: 'same', exercise_id: 10, difficulty: { overall: 4 } },
          { split_label: 'Split 2', variant_type: 'progression', exercise_id: 101, difficulty: { overall: 7 } },
        ],
      }]
    }
    return base
  })
  const result = mockGoldenSplitsPrescription({ blocks })
  evaluateCategory7Lane(result, { ...goldenBody, ageMax: 14 }, checks, {
    tagMap,
    exerciseById,
    difficultyByExerciseId,
    sessionAgeMax: 14,
    thresholds: {},
  })
  const youth = checks.find((c) => c.id === 'progression_youth_age_fit')
  assert.ok(youth)
  assert.equal(youth.ok, false)
})

test('isPhaseAdjacent allows output-capacity adjacency', () => {
  assert.equal(isPhaseAdjacent('output', 'capacity'), true)
  assert.equal(isPhaseAdjacent('prepare_and_access', 'output'), false)
})

test('computeLaneStability returns stability when five runs share pairs', () => {
  const history = Array.from({ length: 5 }, () => ({
    scenario: 'Test 3',
    tier: 'strict',
    cat7PairKeys: ['output:10->101', 'capacity:20->201'],
  }))
  const result = computeLaneStability(history, 'Test 3', { minRuns: 5 })
  assert.equal(result.stability, 1)
})

test('computeFillStability returns stable when fill_pct is constant across runs', () => {
  const history = Array.from({ length: 5 }, () => ({
    scenario: 'Test 3',
    tier: 'strict',
    phase_fill: [
      { phase_key: 'output', fill_pct: 93 },
      { phase_key: 'capacity', fill_pct: 90 },
    ],
  }))
  const result = computeFillStability(history, 'Test 3', { minRuns: 5 })
  assert.equal(result.stable, true)
  assert.equal(result.perPhase.output.std, 0)
})

test('computeChronicUnderfill flags phases below threshold in eval history', () => {
  const history = Array.from({ length: 5 }, (_, i) => ({
    scenario: 'Test 3',
    tier: 'strict',
    phase_fill: [{ phase_key: 'output', fill_pct: i === 0 ? 65 : 95 }],
  }))
  const result = computeChronicUnderfill(history, 'Test 3', { minRuns: 5, threshold: 70 })
  assert.equal(result.chronicCount, 1)
  assert.equal(result.chronicPhases[0][0], 'output')
})

test('evaluateCategory2Fill fails phase_fill_coverage when phase_fill missing a block', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan()
  evaluateCategory2Fill(
    mockResult({
      blocks: blocks.map((b) => ({ ...b, estimated_minutes: b.target_minutes, items: [{ exercise_id: 1, sets: 1 }] })),
      constraint_report: {
        phase_fill: blocks.slice(0, -1).map((b) => ({ phase_key: b.phase_key, fill_pct: 95, pool_size: 10 })),
        empty_phase_reasons: [],
      },
    }),
    goldenBody,
    checks,
  )
  const cov = checks.find((c) => c.id === 'phase_fill_coverage')
  assert.ok(cov)
  assert.equal(cov.ok, false)
})

test('computeCategory2Kpi aggregates fill check pass rate', () => {
  const checks = [
    ...CATEGORY2_KPI_CHECK_IDS.map((id) => ({ id, ok: true, message: 'ok' })),
    { id: 'phase_fill_output', ok: false, message: 'underfill' },
    { id: 'phase_fill_capacity', ok: true, message: 'ok' },
  ]
  const kpi = computeCategory2Kpi(checks, { minRate: 0.92 })
  assert.equal(kpi.ok, false)
  assert.ok(kpi.detail.rate < 0.92)
})

test('evaluateCategory6Progressions fails split2_total_progressions when below threshold', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'output') {
      base.items = [splitProgressionItem(10, 101)]
    }
    return base
  })
  const result = mockGoldenSplitsPrescription({ blocks })
  evaluateCategory6Progressions(result, goldenBody, checks, { exerciseById: new Map() })
  const total = checks.find((c) => c.id === 'split2_total_progressions')
  assert.ok(total)
  assert.equal(total.ok, false)
  const kpi = computeCategory6Kpi(checks)
  assert.equal(kpi.ok, false)
})

test('all CATEGORY12_KPI_CHECK_IDS present when equipment use active', () => {
  const checks = []
  const tagMap = new Map([
    ['101', [{ facetType: 'equipment', facetId: 7 }]],
    ['102', [{ facetType: 'equipment', facetId: 1742 }]],
    ['103', [{ facetType: 'equipment', facetId: 12 }]],
  ])
  const equipmentKeyById = new Map([[7, 'kettlebell'], [1742, 'jump_rope'], [12, 'cones']])
  const blocks = goldenBody.phasePlan.map((row) => ({
    phase_key: row.phaseKey,
    label: row.label,
    target_minutes: row.minutes,
    estimated_minutes: row.minutes,
    items: row.phaseKey === 'output'
      ? [
        { exercise_id: 101, exercise_name: 'KB Swing', difficulty: { overall: 5 } },
        { exercise_id: 102, exercise_name: 'Jump Rope', difficulty: { overall: 4 } },
      ]
      : row.phaseKey === 'capacity'
        ? [{ exercise_id: 103, exercise_name: 'Cone Drill', difficulty: { overall: 5 } }]
        : row.phaseKey === 'movement_intelligence'
          ? [{ exercise_id: 102, exercise_name: 'Jump Rope MI', difficulty: { overall: 4 } }]
          : row.phaseKey === 'sustained_capacity'
            ? [{ exercise_id: 102, exercise_name: 'Jump Rope SC', difficulty: { overall: 4 } }]
            : [],
  }))
  const result = mockResult({
    blocks,
    candidates: [
      { exercise_id: 101, exercise_name: 'KB Swing' },
      { exercise_id: 102, exercise_name: 'Jump Rope' },
      { exercise_id: 103, exercise_name: 'Cone Drill' },
    ],
  })
  evaluateCategory12EquipUse(result, goldenBody, checks, {
    tagMap,
    equipmentKeyById,
    exerciseById: new Map([
      [101, { id: 101, slug: 'kb-swing', name: 'KB Swing' }],
      [102, { id: 102, slug: 'jump-rope', name: 'Jump Rope' }],
      [103, { id: 103, slug: 'cone-drill', name: 'Cone Drill' }],
    ]),
    thresholds: { ...DEFAULT_STRICT_THRESHOLDS, minPhasesPerEquipmentKey: 1 },
    snapshot: goldenSnapshot,
  })
  for (const id of CATEGORY12_KPI_CHECK_IDS) {
    assert.ok(
      checks.some((c) => c.id === id),
      `missing Category 12 KPI check id: ${id}`,
    )
  }
  for (const id of CATEGORY12_MOE_CHECK_IDS) {
    assert.ok(
      checks.some((c) => c.id === id),
      `missing Category 12 MOE check id: ${id}`,
    )
  }
  const kpi = computeCategory12Kpi(checks)
  assert.equal(kpi.id, 'category12_kpi')
})

test('evaluateCategory12EquipUse fails equipment_use_ids_present when use ID missing', () => {
  const checks = []
  const tagMap = new Map([
    ['101', [{ facetType: 'equipment', facetId: 7 }]],
  ])
  const equipmentKeyById = new Map([[7, 'kettlebell'], [1742, 'jump_rope'], [12, 'cones']])
  const result = mockResult({
    blocks: [{
      phase_key: 'output',
      target_minutes: 40,
      estimated_minutes: 38,
      items: [{ exercise_id: 101, exercise_name: 'KB Swing', difficulty: { overall: 5 } }],
    }],
  })
  evaluateCategory12EquipUse(result, goldenBody, checks, {
    tagMap,
    equipmentKeyById,
    thresholds: DEFAULT_STRICT_THRESHOLDS,
    snapshot: goldenSnapshot,
  })
  const idCheck = checks.find((c) => c.id === 'equipment_use_ids_present')
  assert.ok(idCheck)
  assert.equal(idCheck.ok, false)
  const kpi = computeCategory12Kpi(checks)
  assert.equal(kpi.ok, false)
})

test('evaluateCategory12EquipUse fails equipment_token_use_guard on single-token key', () => {
  const checks = []
  const tagMap = new Map([
    ['101', [{ facetType: 'equipment', facetId: 7 }]],
    ['102', [{ facetType: 'equipment', facetId: 1742 }]],
    ['103', [{ facetType: 'equipment', facetId: 12 }]],
    ['104', [{ facetType: 'equipment', facetId: 12 }]],
  ])
  const equipmentKeyById = new Map([[7, 'kettlebell'], [1742, 'jump_rope'], [12, 'cones']])
  const result = mockResult({
    blocks: [
      {
        phase_key: 'output',
        target_minutes: 40,
        estimated_minutes: 38,
        items: [
          { exercise_id: 101, exercise_name: 'KB Swing', difficulty: { overall: 5 } },
          { exercise_id: 102, exercise_name: 'Jump Rope', difficulty: { overall: 4 } },
        ],
      },
      {
        phase_key: 'capacity',
        target_minutes: 30,
        estimated_minutes: 28,
        items: [
          { exercise_id: 103, exercise_name: 'Cone A', difficulty: { overall: 5 } },
          { exercise_id: 104, exercise_name: 'Cone B', difficulty: { overall: 5 } },
        ],
      },
    ],
  })
  evaluateCategory12EquipUse(result, goldenBody, checks, {
    tagMap,
    equipmentKeyById,
    thresholds: { ...DEFAULT_STRICT_THRESHOLDS, minPhasesPerEquipmentKey: 1 },
    snapshot: goldenSnapshot,
  })
  const token = checks.find((c) => c.id === 'equipment_token_use_guard')
  assert.ok(token)
  assert.equal(token.ok, false)
})

test('all CATEGORY13_KPI_CHECK_IDS present when avoid active', () => {
  const result = mockGoldenResultWithRestore({
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: goldenBody.phasePlan.map((r) => ({
        phase_key: r.phaseKey,
        fill_pct: 100,
        pool_size: r.phaseKey === 'restore' ? 5 : 10,
      })),
      equipment_avoid: { excluded_count: 12, sample_names: ['Box Jump', 'Step-up'] },
    },
  })
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById: new Map([
      [1, { id: 1, slug: 'box-breathing-hold', name: 'Box Breathing Hold', primary_phase_key: 'restore' }],
      [2, { id: 2, slug: 'cat-cow', name: 'Cat Cow', primary_phase_key: 'restore' }],
      [3, { id: 3, slug: 'hiit-circuit', name: 'HIIT Circuit', primary_phase_key: 'sustained_capacity' }],
    ]),
    tagMap: new Map(),
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map([[1169, 'hiit']]),
    expandedAvoidEquipIds: new Set([3, 4, 5]),
    equipmentAvoidKeys: ['box', 'plyo_box', 'bench_or_box'],
  })
  for (const id of CATEGORY13_KPI_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 13 KPI check id: ${id}`,
    )
  }
  for (const id of CATEGORY13_MOE_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 13 MOE check id: ${id}`,
    )
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category13_kpi'))
})

test('evaluateCategory13EquipAvoid fails restore_not_box_avoid_false_positive on box breathing sample', () => {
  const checks = []
  const result = mockGoldenResultWithRestore({
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: [],
      equipment_avoid: { excluded_count: 1, sample_names: ['Box Breathing Hold'] },
    },
  })
  evaluateCategory13EquipAvoid(result, goldenBody, checks, {
    expandedAvoidEquipIds: new Set([3]),
    equipmentAvoidKeys: ['box'],
  })
  const fp = checks.find((c) => c.id === 'restore_not_box_avoid_false_positive')
  assert.ok(fp)
  assert.equal(fp.ok, false)
  assert.equal(fp.severity, 'P0')
})

test('evaluateCategory13EquipAvoid fails semantic_avoid_false_negative on untagged plyo slug', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    items: b.phase_key === 'output'
      ? [{ exercise_id: 99, exercise_name: 'Drop Landing Stick', difficulty: { overall: 5 } }]
      : [],
  }))
  const result = mockResult({
    blocks,
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: [],
      equipment_avoid: { excluded_count: 4, sample_names: ['Box Jump'] },
    },
  })
  evaluateCategory13EquipAvoid(result, goldenBody, checks, {
    expandedAvoidEquipIds: new Set([3]),
    equipmentAvoidKeys: ['box'],
    exerciseById: new Map([[99, { id: 99, slug: 'drop-landing-stick', name: 'Drop Landing Stick' }]]),
    tagMap: new Map(),
  })
  const leak = checks.find((c) => c.id === 'semantic_avoid_false_negative')
  assert.ok(leak)
  assert.equal(leak.ok, false)
  assert.equal(leak.severity, 'P0')
})

test('all CATEGORY10_KPI_CHECK_IDS present when expectedBody provided', () => {
  const result = mockGoldenSplitsPrescription({
    audience_profile: {
      ageMin: 8,
      ageMax: 14,
      sessionObjective: 'speed_priority',
      impliedSkillLevel: 'INTERMEDIATE',
      caps: { maxOverall: 6, maxTechnical: 6, maxLoad: 5 },
    },
  })
  const exerciseById = new Map()
  for (const id of [10, 11, 12, 20, 21, 30, 101, 102, 103, 201, 202, 301]) {
    exerciseById.set(id, { id, slug: `ex-${id}`, movement_family: 'sprint', skill_level: 'INTERMEDIATE' })
  }
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById,
    tagMap: new Map(),
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map(),
    tenetKeyById: new Map(),
    scalingProfileByExerciseId: new Map(),
    difficultyByExerciseId: new Map(),
    progressionGraphEdges: new Map(),
    thresholds: DEFAULT_STRICT_THRESHOLDS,
    ageFitWarningStability: { stable: null, runCount: 0, minRuns: 5, counts: [] },
  })
  for (const id of CATEGORY10_KPI_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 10 KPI check id: ${id}`,
    )
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category10_kpi'))
  for (const id of CATEGORY10_MOE_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 10 MOE check id: ${id}`,
    )
  }
})

test('evaluateCategory10AgeFit fails primary_over_cap_count when over_cap primaries present', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'output') {
      base.items = [{
        exercise_id: 10,
        exercise_name: 'Too Hard',
        age_fit: 'over_cap',
        difficulty: { overall: 9, technical: 9, load: 8 },
        per_split: [],
      }]
    }
    return base
  })
  const result = mockGoldenSplitsPrescription({
    blocks,
    audience_profile: { ageMin: 8, ageMax: 14, caps: { maxOverall: 6, maxTechnical: 6, maxLoad: 5 } },
  })
  evaluateCategory10AgeFit(result, goldenBody, checks, { exerciseById: new Map(), difficultyByExerciseId: new Map() })
  const overCap = checks.find((c) => c.id === 'primary_over_cap_count')
  assert.ok(overCap)
  assert.equal(overCap.ok, false)
  const kpi = computeCategory10Kpi(checks)
  assert.equal(kpi.ok, false)
})

test('computeAgeFitWarningStability detects unstable warning counts', () => {
  const history = [
    { scenario: 'Test 3', tier: 'strict', age_fit_warning_count: 0 },
    { scenario: 'Test 3', tier: 'strict', age_fit_warning_count: 0 },
    { scenario: 'Test 3', tier: 'strict', age_fit_warning_count: 1 },
    { scenario: 'Test 3', tier: 'strict', age_fit_warning_count: 0 },
    { scenario: 'Test 3', tier: 'strict', age_fit_warning_count: 0 },
  ]
  const result = computeAgeFitWarningStability(history, 'Test 3', { minRuns: 5 })
  assert.equal(result.stable, false)
  assert.equal(result.counts.length, 5)
})

test('all CATEGORY9_KPI_CHECK_IDS present when splits active', () => {
  const result = mockGoldenSplitsPrescription()
  const exerciseById = new Map()
  for (const id of [10, 11, 12, 20, 21, 30, 101, 102, 103, 201, 202, 301]) {
    exerciseById.set(id, { id, slug: `ex-${id}`, movement_family: 'sprint' })
  }
  const tagMap = new Map()
  for (const id of [10, 11, 12, 20, 21, 30, 101, 102, 103, 201, 202, 301]) {
    tagMap.set(String(id), [{ facetType: 'pattern', facetId: 1, weight: 1 }])
  }
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById,
    tagMap,
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map(),
    tenetKeyById: new Map([[3, 'speed']]),
    scalingProfileByExerciseId: new Map(),
    difficultyByExerciseId: new Map(),
    progressionGraphEdges: new Map(),
    thresholds: DEFAULT_STRICT_THRESHOLDS,
  })
  for (const id of CATEGORY9_KPI_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 9 KPI check id: ${id}`,
    )
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category9_kpi'))
  for (const id of CATEGORY9_MOE_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 9 MOE check id: ${id}`,
    )
  }
})

test('evaluateCategory9Climb fails progression_no_downgrade when delta is zero', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'output') {
      base.items = [{
        exercise_id: 10,
        exercise_name: 'Primary',
        difficulty: { overall: 7, technical: 7, load: 6 },
        per_split: [
          { split_label: 'Split 1', variant_type: 'same', exercise_id: 10, difficulty: { overall: 4 } },
          {
            split_label: 'Split 2',
            variant_type: 'progression',
            exercise_id: 101,
            difficulty: { overall: 7, technical: 7, load: 6 },
            difficulty_cap: 10,
          },
        ],
      }]
    }
    return base
  })
  const result = mockGoldenSplitsPrescription({ blocks })
  evaluateCategory9Climb(result, goldenBody, checks, { sessionAgeMax: 14, thresholds: {} })
  const downgrade = checks.find((c) => c.id === 'progression_no_downgrade')
  assert.ok(downgrade)
  assert.equal(downgrade.ok, false)
  const kpi = computeCategory9Kpi(checks)
  assert.equal(kpi.ok, false)
})

test('evaluateCategory9Climb fails progression_delta_ceiling when delta exceeds 4', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'output') {
      base.items = [{
        exercise_id: 10,
        exercise_name: 'Primary',
        difficulty: { overall: 3, technical: 3, load: 3 },
        per_split: [
          { split_label: 'Split 1', variant_type: 'same', exercise_id: 10, difficulty: { overall: 3 } },
          {
            split_label: 'Split 2',
            variant_type: 'progression',
            exercise_id: 101,
            difficulty: { overall: 10, technical: 10, load: 10 },
            difficulty_cap: 10,
          },
        ],
      }]
    }
    return base
  })
  const result = mockGoldenSplitsPrescription({ blocks })
  evaluateCategory9Climb(result, goldenBody, checks, { sessionAgeMax: 14, thresholds: {} })
  const ceiling = checks.find((c) => c.id === 'progression_delta_ceiling')
  assert.ok(ceiling)
  assert.equal(ceiling.ok, false)
})

test('all CATEGORY14_KPI_CHECK_IDS present when expectedBody provided', () => {
  const families = ['sprint', 'jump', 'throw', 'row', 'landing', 'shuttle', 'breathing', 'core']
  const exerciseById = new Map()
  let idx = 0
  for (const block of goldenBlocksFromPlan()) {
    for (let i = 0; i < 2; i += 1) {
      const id = 1000 + idx
      exerciseById.set(id, {
        id,
        slug: `ex-${id}`,
        name: `Exercise ${id}`,
        movement_family: families[idx % families.length],
      })
      idx += 1
    }
  }
  const blocks = goldenBlocksFromPlan().map((b, bi) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    items: [1000 + bi * 2, 1001 + bi * 2].map((exercise_id) => ({
      exercise_id,
      exercise_name: `Exercise ${exercise_id}`,
      per_split: [],
    })),
  }))
  const result = mockGoldenSplitsPrescription({
    blocks,
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: goldenBody.phasePlan.map((r) => ({
        phase_key: r.phaseKey,
        fill_pct: 100,
        pool_size: 10,
      })),
      equipment_avoid: { sample_names: [] },
      exercise_avoid: { excluded_count: 0 },
      body_region_avoid: { excluded_count: 0 },
    },
  })
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById,
    tagMap: new Map(),
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map(),
    tenetKeyById: new Map(),
    scalingProfileByExerciseId: new Map(),
    difficultyByExerciseId: new Map(),
    progressionGraphEdges: new Map(),
    thresholds: DEFAULT_STRICT_THRESHOLDS,
    bodyRegionFacetIds: new Set(),
    avoidSlugExists: new Map(),
  })
  for (const id of CATEGORY14_KPI_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 14 KPI check id: ${id}`,
    )
  }
  for (const id of CATEGORY14_MOE_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 14 MOE check id: ${id}`,
    )
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category14_kpi'))
  assert.ok(evalResult.checks.some((c) => c.id === 'avoid_tokens_honored'))
})

test('evaluateCategory14MovementAvoid fails exercise_avoid_leak when avoid ID prescribed', () => {
  const checks = []
  const exerciseById = new Map([
    [99, { id: 99, slug: 'avoided-move', name: 'Avoided Move', movement_family: 'sprint' }],
    [10, { id: 10, slug: 'good-move', name: 'Good Move', movement_family: 'jump' }],
  ])
  const blocks = goldenBlocksFromPlan().map((b) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    items: b.phase_key === 'output'
      ? [{ exercise_id: 99, exercise_name: 'Avoided Move', per_split: [] }]
      : [{ exercise_id: 10, exercise_name: 'Good Move', per_split: [] }],
  }))
  const result = mockGoldenSplitsPrescription({
    blocks,
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: [],
      exercise_avoid: { excluded_count: 1 },
      body_region_avoid: { excluded_count: 0 },
    },
  })
  const body = { ...goldenBody, avoidExerciseIds: [99] }
  evaluateCategory14MovementAvoid(result, body, checks, { exerciseById, tagMap: new Map() })
  const leak = checks.find((c) => c.id === 'exercise_avoid_leak')
  assert.ok(leak)
  assert.equal(leak.ok, false)
  assert.equal(leak.severity, 'P0')
  const kpi = computeCategory14Kpi(checks)
  assert.equal(kpi.ok, false)
})

test('all CATEGORY11 check ids present when splits active', () => {
  const result = mockGoldenSplitsPrescription()
  const exerciseById = new Map()
  for (const id of [10, 11, 12, 20, 21, 30, 101, 102, 103, 201, 202, 301]) {
    exerciseById.set(id, { id, slug: `ex-${id}`, movement_family: 'sprint' })
  }
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById,
    tagMap: new Map(),
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map(),
    scalingProfileByExerciseId: new Map(),
    capUtilStability: { stable: null, runCount: 0, minRuns: 5 },
  })
  for (const id of CATEGORY11_KPI_CHECK_IDS) {
    assert.ok(evalResult.checks.some((c) => c.id === id), `missing Category 11 KPI check id: ${id}`)
  }
  for (const id of CATEGORY11_UTIL_CHECK_IDS) {
    assert.ok(evalResult.checks.some((c) => c.id === id), `missing Category 11 util check id: ${id}`)
  }
  for (const id of CATEGORY11_MOE_CHECK_IDS) {
    assert.ok(evalResult.checks.some((c) => c.id === id), `missing Category 11 MOE check id: ${id}`)
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category11_kpi'))
})

test('evaluateCategory11CapUtil fails split_overrides_consistent when override below session cap', () => {
  const checks = []
  const body = {
    ...goldenBody,
    audienceSplits: [
      { label: 'Split 1 (8-10)', ageMin: 8, ageMax: 10, difficultyOverride: 4 },
      { label: 'Split 2 (11-14)', ageMin: 11, ageMax: 14, difficultyOverride: 10 },
    ],
  }
  const result = mockGoldenSplitsPrescription()
  evaluateCategory11CapUtil(result, body, checks, {})
  const splitMos = checks.find((c) => c.id === 'split_overrides_consistent')
  assert.ok(splitMos)
  assert.equal(splitMos.ok, false)
  const kpi = computeCategory11Kpi(checks)
  assert.equal(kpi.ok, false)
})

test('evaluateCategory11CapUtil fails cap_sandbagging_credibility when both phases under 50%', () => {
  const checks = []
  const lowItem = (id, d) => ({
    exercise_id: id,
    exercise_name: `Low ${id}`,
    age_fit: 'good',
    difficulty: { overall: d, technical: d, load: d },
    per_split: [
      { split_label: 'Split 1 (8-10)', variant_type: 'same', difficulty: { overall: d } },
      { split_label: 'Split 2 (11-14)', variant_type: 'same', difficulty: { overall: d } },
    ],
  })
  const blocks = goldenBlocksFromPlan().map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'output') base.items = [lowItem(10, 3), lowItem(11, 4)]
    if (b.phase_key === 'capacity') base.items = [lowItem(20, 3), lowItem(21, 4)]
    return base
  })
  const result = mockGoldenSplitsPrescription({ blocks })
  evaluateCategory11CapUtil(result, goldenBody, checks, {})
  const mor = checks.find((c) => c.id === 'cap_sandbagging_credibility')
  assert.ok(mor)
  assert.equal(mor.ok, false)
})

test('computeCapUtilStability pending with insufficient history', () => {
  const history = [{ scenario: 'Test 3', tier: 'strict', cat11OutputPoolUtil: 0.58 }]
  const result = computeCapUtilStability(history, 'Test 3', { minRuns: 5 })
  assert.equal(result.stable, null)
  assert.equal(result.runCount, 1)
})

test('all CATEGORY18_KPI_CHECK_IDS present when expectedBody provided', () => {
  const result = mockGoldenSplitsPrescription({
    audience_profile: {
      ageMin: 8,
      ageMax: 14,
      caps: { maxOverall: 6, maxTechnical: 6, maxLoad: 5 },
    },
  })
  const exerciseById = new Map()
  for (const id of [10, 11, 12, 20, 21, 30, 101, 102, 103, 201, 202, 301]) {
    exerciseById.set(id, { id, slug: `ex-${id}`, movement_family: 'sprint', skill_level: 'INTERMEDIATE' })
  }
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById,
    tagMap: new Map(),
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map(),
    tenetKeyById: new Map(),
    scalingProfileByExerciseId: new Map(),
    difficultyByExerciseId: new Map(),
    progressionGraphEdges: new Map(),
    thresholds: DEFAULT_STRICT_THRESHOLDS,
    stretchVariantWarningStability: { stable: null, runCount: 0, minRuns: 5, counts: [] },
  })
  for (const id of CATEGORY18_KPI_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 18 KPI check id: ${id}`,
    )
  }
  for (const id of CATEGORY18_MOE_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 18 MOE check id: ${id}`,
    )
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category18_kpi'))
})

test('all CATEGORY19_KPI_CHECK_IDS and MOE ids present when expectedBody provided', () => {
  const result = mockGoldenSplitsPrescription({
    audience_profile: {
      ageMin: 8,
      ageMax: 14,
      caps: { maxOverall: 6, maxTechnical: 6, maxLoad: 5 },
    },
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: goldenBody.phasePlan.map((r) => ({
        phase_key: r.phaseKey,
        fill_pct: 95,
        pool_size: 12,
        skipped_candidates: 2,
      })),
      equipment_avoid: { sample_names: [] },
    },
  })
  const exerciseById = new Map()
  for (const id of [10, 11, 12, 20, 21, 30, 101, 102, 103, 201, 202, 301]) {
    exerciseById.set(id, { id, slug: `ex-${id}`, name: `Exercise ${id}`, movement_family: `family-${id % 6}` })
  }
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById,
    tagMap: new Map(),
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map(),
    equipmentKeyById: new Map([[7, 'kettlebell'], [1742, 'jump_rope'], [12, 'cones']]),
    thresholds: DEFAULT_STRICT_THRESHOLDS,
  })
  for (const id of CATEGORY19_KPI_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 19 KPI check id: ${id}`,
    )
  }
  for (const id of CATEGORY19_MOE_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 19 MOE check id: ${id}`,
    )
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category19_kpi'))
  assert.ok(evalResult.checks.some((c) => c.id === 'phase_pattern_no_repeat'))
  assert.ok(evalResult.checks.some((c) => c.id === 'distinct_exercise_names'))
})

test('evaluateCategory19Diversity fails no_duplicate_session_exercise_ids on duplicate primary id', () => {
  const checks = []
  const exerciseById = new Map([
    [10, { id: 10, slug: 'broad-jump', name: 'Broad Jump', movement_family: 'jump' }],
    [11, { id: 11, slug: 'sprint-start', name: 'Sprint Start', movement_family: 'sprint' }],
  ])
  const blocks = goldenBlocksFromPlan().map((b) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    items: b.phase_key === 'output'
      ? [
          { exercise_id: 10, exercise_name: 'Broad Jump', per_split: [] },
          { exercise_id: 10, exercise_name: 'Broad Jump', per_split: [] },
        ]
      : [{ exercise_id: 11, exercise_name: 'Sprint Start', per_split: [] }],
  }))
  const result = mockGoldenSplitsPrescription({
    blocks,
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: goldenBody.phasePlan.map((r) => ({ phase_key: r.phaseKey, fill_pct: 100, pool_size: 10 })),
    },
  })
  evaluateCategory19Diversity(result, goldenBody, checks, { exerciseById, tagMap: new Map() })
  const dup = checks.find((c) => c.id === 'no_duplicate_session_exercise_ids')
  assert.ok(dup)
  assert.equal(dup.ok, false)
  const kpi = computeCategory19Kpi(checks)
  assert.equal(kpi.ok, false)
})

test('evaluateCategory18Stretch fails stretch_high_intent_mor when stretch in output', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'output') {
      base.items = [{
        exercise_id: 10,
        exercise_name: 'Stretch Drill',
        age_fit: 'stretch',
        difficulty: { overall: 7, technical: 6, load: 6 },
        per_split: [],
      }]
    }
    return base
  })
  const result = mockGoldenSplitsPrescription({
    blocks,
    audience_profile: { ageMin: 8, ageMax: 14, caps: { maxOverall: 6, maxTechnical: 6, maxLoad: 5 } },
  })
  evaluateCategory18Stretch(result, goldenBody, checks, { difficultyByExerciseId: new Map() })
  const mor = checks.find((c) => c.id === 'stretch_high_intent_mor')
  assert.ok(mor)
  assert.equal(mor.ok, false)
  assert.equal(mor.severity, 'P0')
  const kpi = computeCategory18Kpi(checks)
  assert.equal(kpi.ok, false)
})

test('computeStretchVariantWarningStability detects warning spikes', () => {
  const history = [
    { scenario: 'Test 3', tier: 'strict', split_variant_warning_count: 0 },
    { scenario: 'Test 3', tier: 'strict', split_variant_warning_count: 3 },
    { scenario: 'Test 3', tier: 'strict', split_variant_warning_count: 4 },
    { scenario: 'Test 3', tier: 'strict', split_variant_warning_count: 0 },
    { scenario: 'Test 3', tier: 'strict', split_variant_warning_count: 3 },
  ]
  const result = computeStretchVariantWarningStability(history, 'Test 3', { minRuns: 5, spikeThreshold: 2, spikeRuns: 3 })
  assert.equal(result.stable, false)
  assert.equal(result.spikes, 3)
})

test('all CATEGORY15_KPI_CHECK_IDS present when expectedBody provided', () => {
  const result = mockGoldenResultWithRestore({
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: goldenBody.phasePlan.map((r) => ({
        phase_key: r.phaseKey,
        fill_pct: r.phaseKey === 'sustained_capacity' ? 85 : 100,
        pool_size: r.phaseKey === 'sustained_capacity' ? 6 : 10,
      })),
      equipment_avoid: { sample_names: [] },
    },
  })
  const tagMap = new Map([
    ['10', [{ facetType: 'tenet', facetId: 3, weight: 2 }, { facetType: 'pattern', facetId: 1, weight: 1 }]],
    ['11', [{ facetType: 'tenet', facetId: 3, weight: 2 }, { facetType: 'pattern', facetId: 2, weight: 1 }]],
    ['3', [{ facetType: 'methodology', facetId: 1169, weight: 2 }]],
  ])
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById: new Map([
      [1, { id: 1, slug: 'box-breathing-hold', name: 'Box Breathing Hold', primary_phase_key: 'restore', movement_family: 'breathing' }],
      [2, { id: 2, slug: 'cat-cow', name: 'Cat Cow', primary_phase_key: 'restore', movement_family: 'mobility' }],
      [3, { id: 3, slug: 'hiit-circuit', name: 'HIIT Circuit', primary_phase_key: 'sustained_capacity', programming_kind: 'exercise', movement_family: 'conditioning' }],
      [10, { id: 10, slug: 'sprint-start', name: 'Sprint Start', primary_phase_key: 'output', movement_family: 'sprint' }],
      [11, { id: 11, slug: 'bound-series', name: 'Bound Series', primary_phase_key: 'output', movement_family: 'bound' }],
    ]),
    tagMap,
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map([[1169, 'hiit']]),
    tenetKeyById: new Map([[3, 'speed']]),
    expandedAvoidEquipIds: new Set(),
    equipmentAvoidKeys: [],
  })
  for (const id of CATEGORY15_KPI_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 15 KPI check id: ${id}`,
    )
  }
  for (const id of CATEGORY15_MOE_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 15 MOE check id: ${id}`,
    )
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category15_kpi'))
  assert.ok(!evalResult.checks.some((c) => c.id === 'category15_tbd_tenet_scoring'))
})

test('evaluateCategory15Intent fails output_speed_tenet_match when Output lacks speed tags', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'output') {
      base.items = [
        { exercise_id: 50, exercise_name: 'Generic Drill', difficulty: { overall: 4 } },
        { exercise_id: 51, exercise_name: 'Another Drill', difficulty: { overall: 4 } },
      ]
      base.focus_targets = [{ facetType: 'tenet', facetId: 3, weight: 6 }]
    }
    return base
  })
  const result = mockResult({ blocks })
  evaluateCategory15Intent(result, goldenBody, checks, {
    tagMap: new Map([
      ['50', [{ facetType: 'tenet', facetId: 1, weight: 1 }]],
      ['51', [{ facetType: 'tenet', facetId: 2, weight: 1 }]],
    ]),
    exerciseById: new Map(),
    methodologyKeyById: new Map([[1169, 'hiit']]),
    tenetKeyById: new Map([[3, 'speed']]),
  })
  const match = checks.find((c) => c.id === 'output_speed_tenet_match')
  assert.ok(match)
  assert.equal(match.ok, false)
  const kpi = computeCategory15Kpi(checks)
  assert.equal(kpi.ok, false)
})

test('evaluateCategory15Intent fails hiit_in_low_intent_phases on HIIT in Prepare', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'prepare_and_access') {
      base.items = [{ exercise_id: 99, exercise_name: 'HIIT Warmup', difficulty: { overall: 3 } }]
    }
    return base
  })
  const result = mockResult({ blocks })
  evaluateCategory15Intent(result, goldenBody, checks, {
    tagMap: new Map([['99', [{ facetType: 'methodology', facetId: 1169, weight: 2 }]]]),
    exerciseById: new Map(),
    methodologyKeyById: new Map([[1169, 'hiit']]),
  })
  const leak = checks.find((c) => c.id === 'hiit_in_low_intent_phases')
  assert.ok(leak)
  assert.equal(leak.ok, false)
})

function mockConstraintReport(overrides = {}) {
  return {
    empty_phase_reasons: [],
    phase_fill: goldenBody.phasePlan.map((r) => ({
      phase_key: r.phaseKey,
      fill_pct: 100,
      pool_size: 10,
      skipped_candidates: 2,
      split_rejects: 1,
    })),
    equipment_avoid: { excluded_count: 1, sample_names: ['Plyo Box Jump'] },
    exercise_avoid: { excluded_count: 0 },
    body_region_avoid: { excluded_count: 0 },
    ...overrides,
  }
}

test('all CATEGORY20_KPI_CHECK_IDS and MOE ids present when expectedBody provided', () => {
  const blocks = goldenBlocksFromPlan().map((b) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    fill_pct: 100,
    items: [{ exercise_id: 1, exercise_name: 'Drill A', per_split: [] }],
  }))
  const result = mockGoldenSplitsPrescription({
    blocks,
    constraint_report: mockConstraintReport(),
  })
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById: new Map([[1, { id: 1, slug: 'drill-a', movement_family: 'sprint' }]]),
    tagMap: new Map(),
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map(),
    scalingProfileByExerciseId: new Map(),
    poolEmptyStability: { stable: null, runCount: 0, minRuns: 5 },
    splitRejectChronic: { chronic: null, runCount: 0, minRuns: 5 },
  })
  for (const id of CATEGORY20_KPI_CHECK_IDS) {
    assert.ok(evalResult.checks.some((c) => c.id === id), `missing Category 20 KPI check id: ${id}`)
  }
  for (const id of CATEGORY20_MOE_CHECK_IDS) {
    assert.ok(evalResult.checks.some((c) => c.id === id), `missing Category 20 MOE check id: ${id}`)
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category20_kpi'))
  assert.ok(evalResult.checks.some((c) => c.id === 'constraint_report_present'))
})

test('evaluateCategory20Constraint fails constraint_mislabeled_pool_empty_mor when pool_size > 0', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    fill_pct: 100,
    items: [{ exercise_id: 1, exercise_name: 'Drill', per_split: [] }],
  }))
  const result = mockGoldenSplitsPrescription({
    blocks,
    constraint_report: mockConstraintReport({
      empty_phase_reasons: ['Output: pool_empty — no exercises selected for phase/focus/constraints.'],
      phase_fill: goldenBody.phasePlan.map((r) => ({
        phase_key: r.phaseKey,
        fill_pct: 100,
        pool_size: r.phaseKey === 'output' ? 12 : 10,
        skipped_candidates: 1,
        split_rejects: 0,
      })),
    }),
  })
  evaluateCategory20Constraint(result, goldenBody, checks, {})
  const mor = checks.find((c) => c.id === 'constraint_mislabeled_pool_empty_mor')
  assert.ok(mor)
  assert.equal(mor.ok, false)
  assert.equal(mor.severity, 'P0')
  const kpi = computeCategory20Kpi(checks)
  assert.equal(kpi.ok, false)
})

test('evaluateCategory20Constraint fails constraint_no_severe_underfill on underfilled below 50%', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    fill_pct: b.phase_key === 'output' ? 40 : 100,
    items: [{ exercise_id: 1, exercise_name: 'Drill', per_split: [] }],
  }))
  const result = mockGoldenSplitsPrescription({
    blocks,
    constraint_report: mockConstraintReport({
      empty_phase_reasons: ['Output: underfilled (40% of 40m target).'],
    }),
  })
  evaluateCategory20Constraint(result, goldenBody, checks, {})
  const underfill = checks.find((c) => c.id === 'constraint_no_severe_underfill')
  assert.ok(underfill)
  assert.equal(underfill.ok, false)
})

test('computePoolEmptyStability detects unstable pool_empty history', () => {
  const history = [
    { scenario: 'Test 3', tier: 'strict', pool_empty_count: 0 },
    { scenario: 'Test 3', tier: 'strict', pool_empty_count: 0 },
    { scenario: 'Test 3', tier: 'strict', pool_empty_count: 1 },
    { scenario: 'Test 3', tier: 'strict', pool_empty_count: 0 },
    { scenario: 'Test 3', tier: 'strict', pool_empty_count: 0 },
  ]
  const result = computePoolEmptyStability(history, 'Test 3')
  assert.equal(result.stable, false)
  assert.equal(result.runCount, 5)
})

test('all CATEGORY17_KPI_CHECK_IDS present when expectedBody provided', () => {
  const result = mockGoldenSplitsPrescription({
    audience_profile: {
      ageMin: 8,
      ageMax: 14,
      impliedSkillLevel: 'INTERMEDIATE',
      scalingCohort: 'youth_intermediate',
      caps: { maxOverall: 6, maxTechnical: 6, maxLoad: 5 },
    },
    audience_splits: [
      { label: 'Split 1 (8-10)', age_min: 8, age_max: 10, caps: { maxOverall: 6, maxTechnical: 6, maxLoad: 5 } },
      { label: 'Split 2 (11-14)', age_min: 11, age_max: 14, caps: { maxOverall: 10, maxTechnical: 10, maxLoad: 10 } },
    ],
  })
  const exerciseById = new Map()
  for (const id of [10, 11, 12, 20, 21, 30, 101, 102, 103, 201, 202, 301]) {
    exerciseById.set(id, { id, slug: `ex-${id}`, skill_level: 'INTERMEDIATE' })
  }
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById,
    tagMap: new Map(),
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map(),
    difficultyByExerciseId: new Map(),
    safetyProfileByExerciseId: new Map(),
    sportIdByKey: new Map(),
    thresholds: DEFAULT_STRICT_THRESHOLDS,
  })
  for (const id of CATEGORY17_KPI_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 17 KPI check id: ${id}`,
    )
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category17_kpi'))
  for (const id of CATEGORY17_MOE_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 17 MOE check id: ${id}`,
    )
  }
})

test('evaluateCategory17Youth fails mi_no_handstand_youth on handstand in MI', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'movement_intelligence') {
      base.items = [{
        exercise_id: 99,
        exercise_name: 'Wall Handstand Hold',
        per_split: [],
      }]
    }
    return base
  })
  const result = mockGoldenSplitsPrescription({
    blocks,
    audience_profile: { ageMin: 8, ageMax: 14, scalingCohort: 'youth_intermediate' },
  })
  evaluateCategory17Youth(result, goldenBody, checks, {
    exerciseById: new Map([[99, { id: 99, slug: 'wall-handstand-hold', name: 'Wall Handstand Hold' }]]),
    difficultyByExerciseId: new Map(),
    phaseProfileMap: new Map(),
    safetyProfileByExerciseId: new Map(),
    thresholds: DEFAULT_STRICT_THRESHOLDS,
  })
  const gate = checks.find((c) => c.id === 'mi_no_handstand_youth')
  assert.ok(gate)
  assert.equal(gate.ok, false)
  const kpi = computeCategory17Kpi(checks)
  assert.equal(kpi.ok, false)
})

test('all CATEGORY21_KPI_CHECK_IDS and MOE ids present when expectedBody provided', () => {
  const blocks = goldenBlocksFromPlan().map((b) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    items: [{ exercise_id: 1, exercise_name: 'Drill A', age_fit: 'good', per_split: [] }],
  }))
  const result = mockGoldenSplitsPrescription({
    blocks,
    age_fit_warnings: [],
    split_variant_warnings: [],
    audience_profile: {
      ageMin: 8,
      ageMax: 14,
      caps: { maxOverall: 6, maxTechnical: 6, maxLoad: 5 },
    },
  })
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById: new Map([[1, { id: 1, slug: 'drill-a', movement_family: 'sprint' }]]),
    tagMap: new Map(),
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map(),
    thresholds: DEFAULT_STRICT_THRESHOLDS,
    warningPairStability: { stable: null, runCount: 0, minRuns: 5, counts: [] },
    warningCleanStreak: { streak: null, clean: null, runCount: 0, minRuns: 5 },
  })
  for (const id of CATEGORY21_KPI_CHECK_IDS) {
    assert.ok(evalResult.checks.some((c) => c.id === id), `missing Category 21 KPI check id: ${id}`)
  }
  for (const id of CATEGORY21_MOE_CHECK_IDS) {
    assert.ok(evalResult.checks.some((c) => c.id === id), `missing Category 21 MOE check id: ${id}`)
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category21_kpi'))
})

test('evaluateCategory21Warnings fails warnings_no_duplicate_strings on duplicate warnings', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    items: [{ exercise_id: 1, exercise_name: 'Drill A', age_fit: 'good', per_split: [] }],
  }))
  const dup = 'Split 1: Drill A exceeds difficulty cap — coach scaling required.'
  const result = mockGoldenSplitsPrescription({
    blocks,
    age_fit_warnings: [],
    split_variant_warnings: [dup, dup],
    audience_profile: { caps: { maxOverall: 6, maxTechnical: 6, maxLoad: 5 } },
  })
  evaluateCategory21Warnings(result, goldenBody, checks, { thresholds: DEFAULT_STRICT_THRESHOLDS })
  const dupCheck = checks.find((c) => c.id === 'warnings_no_duplicate_strings')
  assert.ok(dupCheck)
  assert.equal(dupCheck.ok, false)
  const kpi = computeCategory21Kpi(checks)
  assert.equal(kpi.ok, false)
})

test('computeWarningPairStability returns stable when counts match across runs', () => {
  const history = Array.from({ length: 5 }, () => ({
    scenario: 'Test 3',
    tier: 'strict',
    age_fit_warning_count: 0,
    split_variant_warning_count: 1,
  }))
  const result = computeWarningPairStability(history, 'Test 3')
  assert.equal(result.stable, true)
  assert.equal(result.pairs[0], '0:1')
})

test('computeWarningCleanStreak returns clean streak for five zero-warning passes', () => {
  const history = Array.from({ length: 5 }, () => ({
    scenario: 'Test 3',
    tier: 'strict',
    ok: true,
    age_fit_warning_count: 0,
    split_variant_warning_count: 0,
  }))
  const result = computeWarningCleanStreak(history, 'Test 3')
  assert.equal(result.clean, true)
  assert.equal(result.streak, 5)
})

test('all CATEGORY22_KPI_CHECK_IDS and MOE ids present when expectedBody provided', () => {
  const blocks = goldenBlocksFromPlan().map((b) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    fill_pct: 100,
    items: [{ exercise_id: 1, exercise_name: 'Drill A', per_split: [] }],
  }))
  const result = mockGoldenSplitsPrescription({
    blocks,
    constraint_report: mockConstraintReport(),
    age_fit_warnings: ['Age warning sample'],
  })
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById: new Map([[1, { id: 1, slug: 'drill-a', movement_family: 'sprint' }]]),
    tagMap: new Map(),
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map(),
    equipmentKeyById: new Map(),
    scalingProfileByExerciseId: new Map(),
    evalInfraOk: true,
    dbSource: 'EXTERNAL_DB_URL',
    facilityId: 1,
    requirementsSource: 'golden-prescription-scenario.json body',
    goldenFeasibilityStability: { stable: null, runCount: 0, minRuns: 5 },
  })
  for (const id of CATEGORY22_KPI_CHECK_IDS) {
    assert.ok(evalResult.checks.some((c) => c.id === id), `missing Category 22 KPI check id: ${id}`)
  }
  for (const id of CATEGORY22_MOE_CHECK_IDS) {
    assert.ok(evalResult.checks.some((c) => c.id === id), `missing Category 22 MOE check id: ${id}`)
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category22_kpi'))
  assert.ok(!evalResult.checks.some((c) => c.id === 'feasibility_minutes_sum'))
})

test('evaluateCategory22Feasibility fails feasibility_output_nonempty when Output empty', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key !== 'output') {
      base.items = [{ exercise_id: 1, exercise_name: 'Drill', per_split: [] }]
    }
    return base
  })
  const result = mockGoldenSplitsPrescription({
    blocks,
    constraint_report: mockConstraintReport(),
  })
  evaluateCategory22Feasibility(result, goldenBody, checks, {
    evalInfraOk: true,
    dbSource: 'EXTERNAL_DB_URL',
    facilityId: 1,
    requirementsSource: 'test',
    equipmentKeyById: new Map(),
  })
  const outputCheck = checks.find((c) => c.id === 'feasibility_output_nonempty')
  assert.ok(outputCheck)
  assert.equal(outputCheck.ok, false)
  assert.equal(outputCheck.severity, 'P0')
  const kpi = computeCategory22Kpi(checks)
  assert.equal(kpi.ok, false)
})

test('PRESCRIPTION_ERROR_CODES documents all thrown codes', () => {
  assert.deepEqual(PRESCRIPTION_ERROR_CODES, ['unsatisfiable_equipment', 'violates_equipment_avoid'])
})

test('computeGoldenFeasibilityStability returns stable when all recent runs pass', () => {
  const history = Array.from({ length: 5 }, () => ({
    scenario: 'Test 3',
    tier: 'strict',
    ok: true,
  }))
  const result = computeGoldenFeasibilityStability(history, 'Test 3')
  assert.equal(result.stable, true)
  assert.equal(result.failCount, 0)
})

function mockFormatItem(overrides = {}) {
  return {
    exercise_id: 1,
    exercise_name: 'Test Move',
    sets: 3,
    reps: 8,
    rest_seconds: 30,
    work_seconds: null,
    est_seconds_per_set: 45,
    score: 7.5,
    phase_fit: 0.8,
    selection_rationale: 'Builds power for Output phase.',
    placement_rationale: 'Placed in Output based on phase fit.',
    difficulty: { overall: 5, load: 5 },
    ...overrides,
  }
}

function mockFormatResult(itemsByPhase = {}) {
  const blocks = goldenBlocksFromPlan().map((b) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    items: itemsByPhase[b.phase_key] ?? [mockFormatItem({ exercise_id: b.phase_key.length })],
  }))
  return {
    blocks,
    audience_profile: { ageMax: 14, ageMin: 8 },
    phase_rationales: blocks.map((b) => ({ phase_key: b.phase_key })),
  }
}

test('evaluateCategory24Format passes on complete dose fields', () => {
  const checks = []
  const ex = { id: 1, default_sets: 3, default_rest_seconds: 30, est_seconds_per_set: 45 }
  const item = mockFormatItem()
  const result = {
    blocks: [{
      phase_key: 'output',
      target_minutes: 4,
      estimated_minutes: 4,
      items: [item],
    }],
    audience_profile: { ageMax: 14, ageMin: 8 },
    phase_rationales: [{ phase_key: 'output' }],
  }
  evaluateCategory24Format(result, goldenBody, checks, {
    exerciseById: new Map([[1, ex]]),
    tagMap: new Map(),
    methodologyKeyById: new Map(),
    doseStability: { stable: null, runCount: 0, minRuns: 5 },
  })
  assert.ok(checks.find((c) => c.id === 'item_sets_present')?.ok)
  assert.ok(checks.find((c) => c.id === 'item_rest_present')?.ok)
  assert.ok(checks.find((c) => c.id === 'format_time_reconciliation')?.ok)
  assert.ok(checks.find((c) => c.id === 'category24_moe_review_packet'))
  for (const id of CATEGORY24_MOE_CHECK_IDS) {
    assert.ok(checks.some((c) => c.id === id), `missing Category 24 MOE: ${id}`)
  }
})

test('evaluateCategory24Format flags item_reps_work_coherence as informational conflict', () => {
  const checks = []
  const result = {
    blocks: [{
      phase_key: 'output',
      target_minutes: 3,
      estimated_minutes: 3,
      items: [mockFormatItem({ reps: 10, work_seconds: 30 })],
    }],
    audience_profile: { ageMax: 14, ageMin: 8 },
    phase_rationales: [{ phase_key: 'output' }],
  }
  evaluateCategory24Format(result, goldenBody, checks, {
    exerciseById: new Map([[1, { id: 1, default_sets: 3, est_seconds_per_set: 45 }]]),
    doseStability: { stable: null, runCount: 0, minRuns: 5 },
  })
  const check = checks.find((c) => c.id === 'item_reps_work_coherence')
  assert.ok(check)
  assert.equal(check.ok, true)
  assert.equal(check.detail?.informational, true)
  assert.equal(check.detail?.ok_band, false)
})

test('evaluateCategory24Format fails item_sets_present when sets missing', () => {
  const checks = []
  const result = mockFormatResult({
    output: [mockFormatItem({ sets: undefined })],
  })
  evaluateCategory24Format(result, goldenBody, checks, {
    exerciseById: new Map([[1, { id: 1, default_sets: 3, est_seconds_per_set: 45 }]]),
    doseStability: { stable: null, runCount: 0, minRuns: 5 },
  })
  const check = checks.find((c) => c.id === 'item_sets_present')
  assert.ok(check)
  assert.equal(check.ok, false)
})

test('computeCategory24Kpi passes when blocking checks pass', () => {
  const checks = CATEGORY24_KPI_CHECK_IDS.map((id) => ({ id, ok: true, message: 'ok' }))
  const kpi = computeCategory24Kpi(checks, { minDoseFidelityIndex: 0.9 })
  assert.equal(kpi.ok, true)
  assert.ok(kpi.detail.fidelityIndex >= 0.9)
})

test('computeDoseStability returns stable when phase minutes constant', () => {
  const phaseMinutes = [
    { phase_key: 'output', estimated_minutes: 40 },
    { phase_key: 'capacity', estimated_minutes: 30 },
  ]
  const history = Array.from({ length: 5 }, () => ({
    scenario: 'Test 3',
    tier: 'strict',
    phase_estimated_minutes: phaseMinutes,
  }))
  const result = computeDoseStability(history, 'Test 3', { minRuns: 5 })
  assert.equal(result.stable, true)
})

test('all CATEGORY24_KPI_CHECK_IDS present when expectedBody provided', () => {
  const result = mockGoldenSplitsPrescription()
  const exerciseById = new Map()
  for (const id of [10, 11, 12, 20, 21, 30, 101, 102, 103, 201, 202, 301]) {
    exerciseById.set(id, {
      id,
      slug: `ex-${id}`,
      default_sets: 3,
      default_rest_seconds: 30,
      est_seconds_per_set: 45,
    })
  }
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById,
    tagMap: new Map(),
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map(),
    doseStability: { stable: null, runCount: 0, minRuns: 5 },
  })
  for (const id of CATEGORY24_KPI_CHECK_IDS) {
    assert.ok(evalResult.checks.some((c) => c.id === id), `missing Category 24 KPI: ${id}`)
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category24_kpi'))
  assert.ok(!evalResult.checks.some((c) => c.id === 'category24_tbd'))
})

function mockCat23ExerciseById() {
  const exerciseById = new Map()
  for (const id of [10, 11, 12, 20, 21, 30, 101, 102, 103, 201, 202, 301]) {
    exerciseById.set(id, {
      id,
      slug: `ankle-pogo-${id}`,
      name: `Ankle Pogo ${id}`,
      movement_family: 'pogo',
      programming_kind: 'exercise',
      sport_id: null,
    })
  }
  return exerciseById
}

test('all CATEGORY23_KPI_CHECK_IDS present when expectedBody provided', () => {
  const result = mockGoldenSplitsPrescription({
    audience_profile: {
      ageMin: 8,
      ageMax: 14,
      sessionObjective: 'speed_priority',
      strengthIntent: false,
      impliedSkillLevel: 'INTERMEDIATE',
    },
  })
  const sportIdByKey = new Map([['fitness', 1]])
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById: mockCat23ExerciseById(),
    tagMap: new Map(),
    sportIdByKey,
    sportKey: 'fitness',
    sportScoringStability: { stable: null, runCount: 0, minRuns: 5, slugKeys: [] },
    difficultyByExerciseId: new Map(),
  })
  for (const id of CATEGORY23_KPI_CHECK_IDS) {
    assert.ok(evalResult.checks.some((c) => c.id === id), `missing Category 23 KPI check id: ${id}`)
  }
  for (const id of CATEGORY23_MOE_CHECK_IDS) {
    assert.ok(evalResult.checks.some((c) => c.id === id), `missing Category 23 MOE check id: ${id}`)
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category23_kpi'))
})

test('evaluateCategory23Sport fails exercise_kind_purity when skill_drill leaks in exercise mode', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    items: b.phase_key === 'output'
      ? [{ exercise_id: 50, exercise_name: 'Handstand Line Drill', per_split: [] }]
      : [],
  }))
  const result = mockGoldenSplitsPrescription({ blocks, work_mode: 'exercise' })
  const exerciseById = new Map([
    [50, { id: 50, slug: 'handstand-line-hold', name: 'Handstand Line Hold', programming_kind: 'skill_drill', sport_id: null }],
  ])
  evaluateCategory23Sport(result, goldenBody, checks, {
    exerciseById,
    sportIdByKey: new Map([['fitness', 1]]),
    sportKey: 'fitness',
  })
  const purity = checks.find((c) => c.id === 'exercise_kind_purity')
  assert.ok(purity)
  assert.equal(purity.ok, false)
  const kpi = computeCategory23Kpi(checks)
  assert.equal(kpi.ok, false)
})

test('evaluateCategory23Sport fails sport_specific_fitness_zero for football catch drill', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    items: b.phase_key === 'movement_intelligence'
      ? [{ exercise_id: 103, exercise_name: 'Football Catch Drill', per_split: [] }]
      : [],
  }))
  const result = mockGoldenSplitsPrescription({ blocks })
  const exerciseById = new Map([
    [103, { id: 103, slug: 'football-catch-scan-drill', name: 'Football Catch Scan Drill', programming_kind: 'exercise', sport_id: 1 }],
  ])
  evaluateCategory23Sport(result, goldenBody, checks, {
    exerciseById,
    sportIdByKey: new Map([['fitness', 1]]),
    sportKey: 'fitness',
  })
  const sportZero = checks.find((c) => c.id === 'sport_specific_fitness_zero')
  assert.ok(sportZero)
  assert.equal(sportZero.ok, false)
  const fb = checks.find((c) => c.id === 'football_baseball_slug_zero')
  assert.ok(fb)
  assert.equal(fb.ok, false)
})

test('evaluateCategory8Reuse emits all KPI and MOE check ids on golden-shaped prescription', () => {
  const checks = []
  const result = mockGoldenSplitsPrescription()
  evaluateCategory8Reuse(result, goldenBody, checks, {
    thresholds: DEFAULT_STRICT_THRESHOLDS,
    tagMap: new Map(),
    exerciseById: new Map(),
    reuseStability: { stability: null, runCount: 0, minRuns: 5 },
  })
  for (const id of CATEGORY8_KPI_CHECK_IDS) {
    assert.ok(checks.some((c) => c.id === id), `missing Category 8 KPI check id: ${id}`)
  }
  for (const id of CATEGORY8_MOE_CHECK_IDS) {
    assert.ok(checks.some((c) => c.id === id), `missing Category 8 MOE check id: ${id}`)
  }
  checks.push(computeCategory8Kpi(checks))
  assert.ok(checks.some((c) => c.id === 'category8_kpi'))
})

test('evaluateCategory8Reuse fails progression_reuse_session_wide when same id used 4x', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'output') {
      base.items = [1, 2, 3, 4].map((id) => ({
        exercise_id: id,
        exercise_name: `Primary ${id}`,
        difficulty: { overall: 4 },
        per_split: [
          { split_label: 'Split 1', variant_type: 'same', exercise_id: id, difficulty: { overall: 4 } },
          { split_label: 'Split 2', variant_type: 'progression', exercise_id: 99, exercise_name: 'Shared Prog', difficulty: { overall: 7 } },
        ],
      }))
    }
    return base
  })
  const result = mockGoldenSplitsPrescription({ blocks })
  evaluateCategory8Reuse(result, goldenBody, checks, {
    thresholds: { ...DEFAULT_STRICT_THRESHOLDS, maxProgressionReuseSessionWide: 3 },
    tagMap: new Map(),
    exerciseById: new Map([[99, { id: 99, movement_family: 'sprint' }]]),
  })
  const sessionWide = checks.find((c) => c.id === 'progression_reuse_session_wide')
  assert.ok(sessionWide)
  assert.equal(sessionWide.ok, false)
})

test('computeReuseStability returns null stability until minRuns', () => {
  const result = computeReuseStability([], 'Saved: Test 3 - Reqs only', { minRuns: 5 })
  assert.equal(result.stability, null)
  assert.equal(result.runCount, 0)
})

test('all CATEGORY25_KPI_CHECK_IDS and MOE ids present when expectedBody provided', () => {
  const phaseFill = goldenBody.phasePlan.map((r) => ({
    phase_key: r.phaseKey,
    fill_pct: 100,
    pool_size: r.phaseKey === 'output' ? 50 : r.phaseKey === 'sustained_capacity' ? 12 : 25,
    skipped_candidates: 2,
    split_rejects: 1,
    progression_coverage: ['output', 'capacity'].includes(r.phaseKey) ? 0.75 : null,
  }))
  const candidates = Array.from({ length: 25 }, (_, i) => ({
    exercise_id: i + 1,
    exercise_name: `Candidate ${i + 1}`,
    score: 10 - i * 0.2,
    primary_phase: i < 15 ? 'output' : 'capacity',
    difficulty: { overall: 6 + (i % 3) },
  }))
  const blocks = goldenBlocksFromPlan().map((b) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    fill_pct: 100,
    items: [{ exercise_id: 1, exercise_name: 'Drill A', per_split: [] }],
  }))
  const result = mockGoldenSplitsPrescription({
    blocks,
    candidates,
    constraint_report: mockConstraintReport({ phase_fill: phaseFill }),
  })
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    exerciseById: new Map([[1, { id: 1, slug: 'drill-a', movement_family: 'sprint' }]]),
    tagMap: new Map(),
    phaseProfileMap: new Map(),
    methodologyKeyById: new Map([[1169, 'hiit']]),
    progressionGraphEdges: new Map([[1, new Set([2])]]),
    publishedExerciseCount: 250,
    hiitFallbackChronic: { chronic: null, runCount: 0, minRuns: 5 },
    goldenFeasibilityStability: { stable: null, runCount: 0, minRuns: 5 },
    poolEmptyStability: { stable: null, runCount: 0, minRuns: 5 },
  })
  for (const id of CATEGORY25_KPI_CHECK_IDS) {
    assert.ok(evalResult.checks.some((c) => c.id === id), `missing Category 25 KPI check id: ${id}`)
  }
  for (const id of CATEGORY25_MOE_CHECK_IDS) {
    assert.ok(evalResult.checks.some((c) => c.id === id), `missing Category 25 MOE check id: ${id}`)
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category25_kpi'))
  assert.ok(evalResult.checks.some((c) => c.id === 'category25_moe_review_packet'))
})

test('evaluateCategory25Library fails library_pool_floor_output when pool below floor', () => {
  const checks = []
  const phaseFill = goldenBody.phasePlan.map((r) => ({
    phase_key: r.phaseKey,
    fill_pct: 100,
    pool_size: r.phaseKey === 'output' ? 5 : 25,
    progression_coverage: r.phaseKey === 'output' ? 0.8 : null,
  }))
  const result = mockGoldenSplitsPrescription({
    constraint_report: mockConstraintReport({ phase_fill: phaseFill }),
    candidates: Array.from({ length: 25 }, (_, i) => ({
      exercise_id: i + 1,
      score: 5,
      primary_phase: 'output',
      difficulty: { overall: 6 },
    })),
  })
  evaluateCategory25Library(result, goldenBody, checks, { progressionGraphEdges: new Map() })
  const floor = checks.find((c) => c.id === 'library_pool_floor_output')
  assert.ok(floor)
  assert.equal(floor.ok, false)
  const kpi = computeCategory25Kpi(checks)
  assert.equal(kpi.ok, false)
})

test('evaluateCategory25Library fails library_hiit_fallback_rate when fallback count > 1', () => {
  const checks = []
  const blocks = goldenBlocksFromPlan().map((b) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    items: b.phase_key === 'sustained_capacity'
      ? [
          { exercise_id: 1, exercise_name: 'HIIT A', selection_rationale: 'relaxed sustained pool fill' },
          { exercise_id: 2, exercise_name: 'HIIT B', selection_rationale: 'HIIT fallback path' },
        ]
      : [{ exercise_id: 3, exercise_name: 'Drill', per_split: [] }],
  }))
  const phaseFill = goldenBody.phasePlan.map((r) => ({
    phase_key: r.phaseKey,
    fill_pct: 100,
    pool_size: 30,
    progression_coverage: 0.8,
  }))
  const result = mockGoldenSplitsPrescription({
    blocks,
    constraint_report: mockConstraintReport({ phase_fill: phaseFill }),
    candidates: Array.from({ length: 25 }, (_, i) => ({ exercise_id: i + 1, score: 5, primary_phase: 'output', difficulty: { overall: 6 } })),
  })
  evaluateCategory25Library(result, goldenBody, checks, { progressionGraphEdges: new Map() })
  const fb = checks.find((c) => c.id === 'library_hiit_fallback_rate')
  assert.ok(fb)
  assert.equal(fb.ok, false)
})

test('computeHiitFallbackChronic returns chronic when all recent runs have zero fallback', () => {
  const history = Array.from({ length: 5 }, () => ({
    scenario: 'Test 3',
    tier: 'strict',
    hiit_fallback_count: 0,
  }))
  const result = computeHiitFallbackChronic(history, 'Test 3', { minRuns: 5 })
  assert.equal(result.chronic, true)
  assert.equal(result.runCount, 5)
})

// ─── Category 16 — Phase-appropriate primaries ───────────────────────────────

function mockCat16Prescription(overrides = {}) {
  const itemsByPhase = {
    prepare_and_access: [
      { exercise_id: 401, exercise_name: 'Leg Swings', difficulty: { overall: 2, load: 1 }, per_split: [] },
      { exercise_id: 402, exercise_name: 'A-March', difficulty: { overall: 3, load: 2 }, per_split: [] },
    ],
    movement_intelligence: [
      { exercise_id: 403, exercise_name: 'Skater Balance', difficulty: { overall: 3, load: 2 }, per_split: [] },
      { exercise_id: 404, exercise_name: 'Crawl Pattern', difficulty: { overall: 3, load: 2 }, per_split: [] },
    ],
    output: [{ exercise_id: 405, exercise_name: 'Sprint Start', difficulty: { overall: 5, load: 4 }, per_split: [] }],
    capacity: [{ exercise_id: 406, exercise_name: 'Sled Push', difficulty: { overall: 5, load: 5 }, per_split: [] }],
    resilience: [{ exercise_id: 407, exercise_name: 'Nordic Curl', difficulty: { overall: 5, load: 5 }, per_split: [] }],
    sustained_capacity: [
      { exercise_id: 408, exercise_name: 'HIIT Circuit', difficulty: { overall: 5, load: 4 }, per_split: [] },
      { exercise_id: 409, exercise_name: 'Bike Intervals', difficulty: { overall: 5, load: 4 }, per_split: [] },
    ],
    restore: [{ exercise_id: 410, exercise_name: 'Box Breathing', difficulty: { overall: 1, load: 1 }, per_split: [] }],
  }
  const blocks = goldenBlocksFromPlan().map((b) => ({
    ...b,
    estimated_minutes: b.target_minutes,
    items: itemsByPhase[b.phase_key] ?? [],
  }))
  return mockResult({
    blocks,
    work_mode: 'exercise',
    audience_profile: { sessionObjective: 'speed_priority', ageMax: 14, caps: { maxOverall: 6 } },
    ...overrides,
  })
}

function mockCat16Context(overrides = {}) {
  const exerciseById = new Map([
    [401, { id: 401, slug: 'leg-swings', name: 'Leg Swings', primary_phase_key: 'prepare_and_access', programming_kind: 'exercise', movement_family: 'sprint' }],
    [402, { id: 402, slug: 'a-march', name: 'A-March', primary_phase_key: 'prepare_and_access', programming_kind: 'exercise', movement_family: 'sprint' }],
    [403, { id: 403, slug: 'skater-balance', name: 'Skater Balance', primary_phase_key: 'movement_intelligence', phase_subrole: 'single_leg_balance_foot_ankle_hip_control', programming_kind: 'exercise' }],
    [404, { id: 404, slug: 'crawl-pattern', name: 'Crawl Pattern', primary_phase_key: 'movement_intelligence', phase_subrole: 'locomotion_sprint_mechanics', programming_kind: 'exercise' }],
    [405, { id: 405, slug: 'sprint-start', name: 'Sprint Start', primary_phase_key: 'output', programming_kind: 'exercise', movement_family: 'sprint' }],
    [406, { id: 406, slug: 'sled-push', name: 'Sled Push', primary_phase_key: 'capacity', programming_kind: 'exercise' }],
    [407, { id: 407, slug: 'nordic-curl', name: 'Nordic Curl', primary_phase_key: 'resilience', programming_kind: 'exercise' }],
    [408, { id: 408, slug: 'hiit-circuit', name: 'HIIT Circuit', primary_phase_key: 'sustained_capacity', programming_kind: 'exercise' }],
    [409, { id: 409, slug: 'bike-intervals', name: 'Bike Intervals', primary_phase_key: 'sustained_capacity', programming_kind: 'exercise' }],
    [410, { id: 410, slug: 'box-breathing', name: 'Box Breathing', primary_phase_key: 'restore', programming_kind: 'exercise' }],
  ])
  const phaseProfileMap = new Map()
  const roleByPhase = {
    401: 'prepare_and_access', 402: 'prepare_and_access',
    403: 'movement_intelligence', 404: 'movement_intelligence',
    405: 'output', 406: 'capacity', 407: 'resilience',
    408: 'sustained_capacity', 409: 'sustained_capacity', 410: 'restore',
  }
  for (const [id, phaseKey] of Object.entries(roleByPhase)) {
    phaseProfileMap.set(String(id), [{ phaseKey, role: 'primary', impactLevel: 1, orderSlot: null }])
  }
  return {
    exerciseById,
    tagMap: new Map([
      ['408', [{ facetType: 'methodology', facetId: 1169, weight: 2 }]],
      ['409', [{ facetType: 'methodology', facetId: 1169, weight: 2 }]],
    ]),
    phaseProfileMap,
    methodologyKeyById: new Map([[1169, 'hiit']]),
    intentKeyById: new Map(),
    difficultyByExerciseId: new Map(),
    phaseOrderSlotKeysByPhase: new Map(),
    ...overrides,
  }
}

test('all CATEGORY16_KPI_CHECK_IDS and MOE ids present when expectedBody provided', () => {
  const result = mockCat16Prescription({
    constraint_report: mockConstraintReport(),
    phase_rationales: goldenBody.phasePlan.map((r) => ({ phase_key: r.phaseKey })),
  })
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    sessionAgeMax: 14,
    expectedBody: goldenBody,
    ...mockCat16Context(),
    scalingProfileByExerciseId: new Map(),
    expandedAvoidEquipIds: new Set(),
    equipmentAvoidKeys: [],
  })
  for (const id of CATEGORY16_KPI_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 16 KPI check id: ${id}`,
    )
  }
  for (const id of CATEGORY16_MOE_CHECK_IDS) {
    assert.ok(
      evalResult.checks.some((c) => c.id === id),
      `missing Category 16 MOE check id: ${id}`,
    )
  }
  assert.ok(evalResult.checks.some((c) => c.id === 'category16_kpi'))
  assert.ok(!evalResult.checks.some((c) => String(c.id).startsWith('category16_tbd')))
})

test('evaluateCategory16PhasePrimaries passes happy path and computes passing KPI', () => {
  const checks = []
  evaluateCategory16PhasePrimaries(mockCat16Prescription(), goldenBody, checks, mockCat16Context())
  for (const id of [
    'phase_primary_role_alignment',
    'phase_profile_role_not_avoid',
    'phase_profile_coverage',
    'sustained_primary_containment',
    'capacity_primary_low_intent_leak',
    'resilience_primary_containment',
    'prepare_impact_ceiling',
    'prepare_methodology_gate',
    'mi_heavy_load_youth',
    'youth_output_primary_low_intent',
    'low_intent_difficulty_ceiling',
    'phase_min_items_met',
    'programming_kind_matches_work_mode',
    'phase_plan_keys_canonical',
  ]) {
    const check = checks.find((c) => c.id === id)
    assert.ok(check, `missing check ${id}`)
    assert.equal(check.ok, true, `${id} should pass: ${check.message}`)
  }
  const kpi = computeCategory16Kpi(checks)
  assert.equal(kpi.ok, true)
})

test('evaluateCategory16PhasePrimaries fails sustained_primary_containment when sustained-primary leaks to Output', () => {
  const checks = []
  const context = mockCat16Context()
  context.exerciseById.get(405).primary_phase_key = 'sustained_capacity'
  evaluateCategory16PhasePrimaries(mockCat16Prescription(), goldenBody, checks, context)
  const containment = checks.find((c) => c.id === 'sustained_primary_containment')
  assert.ok(containment)
  assert.equal(containment.ok, false)
  const kpi = computeCategory16Kpi(checks)
  assert.equal(kpi.ok, false)
})

test('evaluateCategory16PhasePrimaries fails programming_kind_matches_work_mode on skill_drill primary', () => {
  const checks = []
  const context = mockCat16Context()
  context.exerciseById.get(403).programming_kind = 'skill_drill'
  evaluateCategory16PhasePrimaries(mockCat16Prescription(), goldenBody, checks, context)
  const kind = checks.find((c) => c.id === 'programming_kind_matches_work_mode')
  assert.ok(kind)
  assert.equal(kind.ok, false)
})

test('evaluateCategory16PhasePrimaries fails youth_output_primary_low_intent for output-primary in MI', () => {
  const checks = []
  const context = mockCat16Context()
  context.exerciseById.get(404).primary_phase_key = 'output'
  evaluateCategory16PhasePrimaries(mockCat16Prescription(), goldenBody, checks, context)
  const youth = checks.find((c) => c.id === 'youth_output_primary_low_intent')
  assert.ok(youth)
  assert.equal(youth.ok, false)
})

test('evaluateCategory16PhasePrimaries fails phase_profile_role_not_avoid on avoid-role primary', () => {
  const checks = []
  const context = mockCat16Context()
  context.phaseProfileMap.set('405', [{ phaseKey: 'output', role: 'avoid', impactLevel: 1 }])
  evaluateCategory16PhasePrimaries(mockCat16Prescription(), goldenBody, checks, context)
  const avoid = checks.find((c) => c.id === 'phase_profile_role_not_avoid')
  assert.ok(avoid)
  assert.equal(avoid.ok, false)
})

test('evaluateCategory16PhasePrimaries fails prepare_methodology_gate on high-arousal Prepare tag', () => {
  const checks = []
  const context = mockCat16Context()
  context.tagMap.set('401', [{ facetType: 'methodology', facetId: 1169, weight: 2 }])
  evaluateCategory16PhasePrimaries(mockCat16Prescription(), goldenBody, checks, context)
  const gate = checks.find((c) => c.id === 'prepare_methodology_gate')
  assert.ok(gate)
  assert.equal(gate.ok, false)
})

test('evaluateCategory16PhasePrimaries fails mi_heavy_load_youth when MI load >= 7 for youth', () => {
  const checks = []
  const result = mockCat16Prescription()
  const mi = result.blocks.find((b) => b.phase_key === 'movement_intelligence')
  mi.items[0].difficulty = { overall: 5, load: 7 }
  evaluateCategory16PhasePrimaries(result, goldenBody, checks, mockCat16Context())
  const heavy = checks.find((c) => c.id === 'mi_heavy_load_youth')
  assert.ok(heavy)
  assert.equal(heavy.ok, false)
})

test('evaluateCategory16PhasePrimaries fails phase_min_items_met when Prepare has one item', () => {
  const checks = []
  const result = mockCat16Prescription()
  const prepare = result.blocks.find((b) => b.phase_key === 'prepare_and_access')
  prepare.items = prepare.items.slice(0, 1)
  evaluateCategory16PhasePrimaries(result, goldenBody, checks, mockCat16Context())
  const minItems = checks.find((c) => c.id === 'phase_min_items_met')
  assert.ok(minItems)
  assert.equal(minItems.ok, false)
})

test('evaluateCategory16PhasePrimaries fails order_slot_phase_taxonomy on foreign slot', () => {
  const checks = []
  const context = mockCat16Context({
    phaseOrderSlotKeysByPhase: new Map([['restore', new Set(['cooldown_breathing'])]]),
  })
  context.phaseProfileMap.set('410', [{ phaseKey: 'restore', role: 'primary', impactLevel: 0, orderSlot: 'max_output_sprint' }])
  evaluateCategory16PhasePrimaries(mockCat16Prescription(), goldenBody, checks, context)
  const slot = checks.find((c) => c.id === 'order_slot_phase_taxonomy')
  assert.ok(slot)
  assert.equal(slot.ok, false)
})

test('evaluateCategory16PhasePrimaries fails phase_plan_keys_canonical on unknown phase key', () => {
  const checks = []
  const body = {
    ...goldenBody,
    phasePlan: [...goldenBody.phasePlan, { phaseKey: 'class_iteration_warmup', label: 'Bogus', minutes: 0 }],
  }
  evaluateCategory16PhasePrimaries(mockCat16Prescription(), body, checks, mockCat16Context())
  const canonical = checks.find((c) => c.id === 'phase_plan_keys_canonical')
  assert.ok(canonical)
  assert.equal(canonical.ok, false)
})
