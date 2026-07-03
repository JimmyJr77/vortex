import test from 'node:test'
import assert from 'node:assert/strict'
import { computeOrderAdditionalFees, calendarYearKey } from '../additionalFeesEngine.js'

test('once_per_year fee is skipped when member already redeemed this calendar year', () => {
  const year = calendarYearKey(new Date('2026-06-15'))
  const feeId = 7
  const result = computeOrderAdditionalFees({
    fees: [
      {
        id: feeId,
        name: 'Annual Fee',
        amountCents: 8500,
        applyBasis: 'per_order',
        applyInterval: 1,
        triggerType: 'once_per_year',
        scopeLevel: 'global',
        active: true,
        priority: 100,
      },
    ],
    lines: [{ key: '1:2:3', formId: 1, programId: 1, sportId: 1, offeringId: 1 }],
    redeemedPeriodKeys: new Set([`${feeId}:${year}`]),
    now: new Date('2026-06-15').getTime(),
  })

  assert.equal(result.enabled, false)
  assert.equal(result.totalOneTimeCents, 0)
})

test('once_per_year fee charges when not yet redeemed this calendar year', () => {
  const result = computeOrderAdditionalFees({
    fees: [
      {
        id: 7,
        name: 'Annual Fee',
        amountCents: 8500,
        applyBasis: 'per_order',
        applyInterval: 1,
        triggerType: 'once_per_year',
        scopeLevel: 'global',
        active: true,
        priority: 100,
      },
    ],
    lines: [{ key: '1:2:3', formId: 1, programId: 1, sportId: 1, offeringId: 1 }],
    redeemedPeriodKeys: new Set(),
    now: new Date('2026-06-15').getTime(),
  })

  assert.equal(result.enabled, true)
  assert.equal(result.totalOneTimeCents, 8500)
})
