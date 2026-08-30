import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPriceScheduleSegments,
  buildSubscriptionScheduleCreateParams,
} from '../stripePriceSchedules.js'

test('a schedule created from a subscription does not send incompatible metadata', () => {
  const params = buildSubscriptionScheduleCreateParams('sub_123')

  assert.deepEqual(params, { from_subscription: 'sub_123' })
  assert.equal('metadata' in params, false)
})

test('Stripe price phases merge adjacent months with the same amount and retain reversion', () => {
  const amounts = new Map([
    ['2026-08', 10000],
    ['2026-09', 10000],
    ['2026-10', 8000],
    ['2026-12', 10000],
  ])
  const segments = buildPriceScheduleSegments({
    currentMonth: '2026-08',
    currentPhaseStart: 123456,
    boundaries: ['2026-09', '2026-10', '2026-12'],
    amountByMonth: amounts,
  })
  assert.deepEqual(segments.map((segment) => ({ periodKey: segment.periodKey, amountCents: segment.amountCents })), [
    { periodKey: '2026-08', amountCents: 10000 },
    { periodKey: '2026-10', amountCents: 8000 },
    { periodKey: '2026-12', amountCents: 10000 },
  ])
  assert.equal(segments[0].startDate, 123456)
  assert.equal(segments[0].endDate, Date.UTC(2026, 9, 1) / 1000)
  assert.equal(segments[1].endDate, Date.UTC(2026, 11, 1) / 1000)
  assert.equal(segments[2].endDate, null)
})

test('a finite schedule ends after the release boundary even when its final prices merge', () => {
  const segments = buildPriceScheduleSegments({
    currentMonth: '2026-08',
    currentPhaseStart: 123456,
    boundaries: ['2026-09'],
    amountByMonth: new Map([
      ['2026-08', 8000],
      ['2026-09', 8000],
    ]),
    releaseAfterMonth: '2026-10',
  })
  assert.equal(segments.length, 1)
  assert.equal(segments[0].endDate, Date.UTC(2026, 9, 1) / 1000)
})
