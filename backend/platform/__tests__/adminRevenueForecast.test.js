import assert from 'node:assert/strict'
import test from 'node:test'
import { revenueForecastMonths, summarizeRevenueForecast } from '../adminRevenueForecast.js'

test('forecast spans the current month and two upcoming months across year boundaries', () => {
  assert.deepEqual(revenueForecastMonths(new Date('2026-12-29T12:00:00Z')).map((month) => month.key), ['2026-12', '2027-01', '2027-02'])
})

test('current owed excludes paid amounts; future posted bills replace projections without losing custom bills', () => {
  const months = revenueForecastMonths(new Date('2026-09-29T12:00:00Z'))
  const result = summarizeRevenueForecast(months, [
    { month_key: '2026-09', amount_cents: 15000, remaining_cents: 3000 },
    { month_key: '2026-09', amount_cents: 7500, remaining_cents: 0 },
    { month_key: '2026-10', subscription_id: 1, amount_cents: 9000, remaining_cents: 0 },
    { month_key: '2026-10', subscription_id: null, amount_cents: 1500, remaining_cents: 1500 },
  ], [
    { key: '2026-10', lines: [{ subscriptionId: 1, netCents: 10000 }, { subscriptionId: 2, netCents: 8000 }] },
    { key: '2026-11', lines: [{ subscriptionId: 1, netCents: 10000 }, { subscriptionId: 2, netCents: 7000 }] },
  ])
  assert.equal(result[0].owedCents, 3000)
  assert.equal(result[1].expectedCents, 18500)
  assert.equal(result[2].expectedCents, 17000)
})
