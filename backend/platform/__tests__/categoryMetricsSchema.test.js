import assert from 'node:assert/strict'
import test from 'node:test'
import {
  validateMetricRow,
  validateCategoryMetrics,
  isHardGateEligibleMetric,
  isEvaluableAllowed,
} from '../categoryMetricsSchema.js'
import { loadMetricsCatalog, makeShiftedC20Metric } from './evalLoopFixtures.js'

test('validateMetricRow fails on shifted Category 20 row check_id=yes', () => {
  const v = validateMetricRow(makeShiftedC20Metric())
  assert.ok(v.some((msg) => msg.includes('check_id')))
  assert.ok(v.some((msg) => msg.includes('Metric must not be type token')))
})

test('validateMetricRow fails on Metric=MOP', () => {
  const v = validateMetricRow(makeShiftedC20Metric())
  assert.ok(v.some((msg) => msg.includes('MOP')))
})

test('validateCategoryMetrics passes on committed 785 metrics', () => {
  const catalog = loadMetricsCatalog()
  const result = validateCategoryMetrics(catalog)
  assert.equal(result.total, 785)
  assert.equal(Object.keys(catalog.categories).length, 25)
  assert.equal(result.ok, true, result.violations.slice(0, 5).join('\n'))
})

test('validateMetricRow fails Evaluable? backticked shift artifacts', () => {
  for (const evaluable of ['`no_empty_phases`', '`constraint_report_schema`', '`category20_kpi`']) {
    const v = validateMetricRow({
      ID: 'C20-MOP-99',
      Metric: 'Bad',
      Prerequisites: 'x',
      'In app?': 'yes',
      check_id: 'real_check',
      'Evaluable?': evaluable,
    })
    assert.ok(v.some((msg) => msg.includes('backticked check id')), evaluable)
  }
})

test('validateMetricRow fails In app? containing prerequisite not yes/no/partial', () => {
  const v = validateMetricRow({
    ID: 'C20-MOP-99',
    Metric: 'Bad',
    Prerequisites: 'x',
    'In app?': '`empty_phase_reasons`',
    check_id: 'yes',
    'Evaluable?': 'yes',
  })
  assert.ok(v.some((msg) => msg.includes('In app?')))
  assert.ok(v.some((msg) => msg.includes('check_id')))
})

test('isEvaluableAllowed accepts plan variants', () => {
  assert.equal(isEvaluableAllowed('yes'), true)
  assert.equal(isEvaluableAllowed('yes (P0)'), true)
  assert.equal(isEvaluableAllowed('partial (manual)'), true)
  assert.equal(isEvaluableAllowed('yes (TBD stub)'), true)
  assert.equal(isEvaluableAllowed('yes (lagging)'), true)
})

test('C20-MOP-01 normalized in committed JSON', () => {
  const catalog = loadMetricsCatalog()
  const row = catalog.all_metrics.find((m) => m.ID === 'C20-MOP-01')
  assert.ok(row)
  assert.equal(row.Metric, 'No pool_empty reasons')
  assert.equal(row['In app?'], 'yes')
  assert.equal(row.check_id, 'no_empty_phases')
  assert.ok(isHardGateEligibleMetric({ ...row, 'Evaluable?': 'yes' }))
})

test('isHardGateEligibleMetric rejects partial manual TBD info', () => {
  assert.equal(isHardGateEligibleMetric({
    'In app?': 'yes',
    'Evaluable?': 'partial (manual)',
    check_id: 'category20_moe_review_packet',
    Metric: 'Review',
  }), false)
  assert.equal(isHardGateEligibleMetric({
    'In app?': 'yes',
    'Evaluable?': 'yes (TBD stub)',
    check_id: 'category20_tbd_split_reject_codes',
    Metric: 'TBD',
  }), false)
})
