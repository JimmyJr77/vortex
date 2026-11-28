import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLeadConversionTrend, conversionRange } from '../leadConversionTrend.js'

test('conversion dates reject impossible, future, reversed and oversized ranges', () => {
  for (const query of [{ end: 'bad' }, { start: '2026-02-30' }, { end: '2026-12-01' },
    { start: '2026-11-26', end: '2026-11-25' }, { start: '2020-01-01' }, { interval: 'year' }, { end: ['2026-11-27'] }]) {
    assert.throws(() => conversionRange(query, '2026-11-27'), { statusCode: 400 })
  }
  assert.deepEqual(conversionRange({}, '2026-11-27'), { start: '2025-11-28', end: '2026-11-27', interval: 'month' })
})

test('weekly buckets use Monday, zero-fill missing activity and preserve partial endpoints', () => {
  const data = buildLeadConversionTrend([
    { day: '2026-11-01', measure: 'inquiries', count: 3 },
    { day: '2026-11-02', measure: 'conversions', count: 2 },
    { day: '2026-11-02', measure: 'directSignups', count: 1 },
    { day: '2026-11-01', measure: 'totalLeads', count: 4 },
    { day: '2026-10-31', measure: 'conversions', count: 999 },
  ], { start: '2026-11-01', end: '2026-11-17', interval: 'week' }, '2026-11-27', 'America/New_York')
  assert.deepEqual(data.buckets.map(row => [row.key, row.start, row.end]), [
    ['2026-10-26', '2026-11-01', '2026-11-01'], ['2026-11-02', '2026-11-02', '2026-11-08'],
    ['2026-11-09', '2026-11-09', '2026-11-15'], ['2026-11-16', '2026-11-16', '2026-11-17'],
  ])
  assert.deepEqual(data.totals, { inquiries: 3, freeTrials: 0, dropIns: 0, directSignups: 1, conversions: 2, totalLeads: 4 })
  assert.equal(data.buckets[2].conversions, 0)
})
