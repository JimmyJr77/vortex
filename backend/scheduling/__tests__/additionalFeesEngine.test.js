import test from 'node:test'
import assert from 'node:assert/strict'
import { computeOrderAdditionalFees, calendarYearKey } from '../additionalFeesEngine.js'

test('once_per_year fee is skipped when member already has an active anniversary redemption', () => {
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
    redeemedPeriodKeys: new Set([`${feeId}:active`]),
    now: new Date('2026-06-15').getTime(),
  })

  assert.equal(result.enabled, false)
  assert.equal(result.totalOneTimeCents, 0)
})

test('once_per_year fee is skipped for legacy calendar-year redemption keys', () => {
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

test('once_per_year fee charges when not yet redeemed this membership year', () => {
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

const annualFee = {
  id: 7,
  name: 'Annual Fee',
  amountCents: 8500,
  applyBasis: 'per_order',
  applyInterval: 1,
  triggerType: 'once_per_year',
  scopeLevel: 'global',
  active: true,
  priority: 100,
}

const regFee = {
  id: 8,
  name: 'Registration Fee',
  amountCents: 2500,
  applyBasis: 'per_order',
  applyInterval: 1,
  triggerType: 'each_enrollment',
  scopeLevel: 'global',
  active: true,
  priority: 100,
}

const feeLines = [{ key: '1:2:3', formId: 1, programId: 1, sportId: 1, offeringId: 1 }]

test('membership promo waives annual fee to $0 but keeps the item with gross/discount split', () => {
  const result = computeOrderAdditionalFees({
    fees: [annualFee, regFee],
    lines: feeLines,
    redeemedPeriodKeys: new Set(),
    membershipPromo: {
      rule: { id: 42, config: { discountKind: 'free_access', benefit_type: 'annual_membership' } },
      code: 'freemem',
    },
    now: new Date('2026-06-15').getTime(),
  })

  const annual = result.items.find((i) => i.feeId === 7)
  assert.equal(annual.amountCents, 0)
  assert.equal(annual.grossAmountCents, 8500)
  assert.equal(annual.discountCents, 8500)
  assert.equal(annual.promoRuleId, 42)
  assert.equal(annual.promoCode, 'freemem')
  // Registration fee is untouched and totals only include net amounts.
  const reg = result.items.find((i) => i.feeId === 8)
  assert.equal(reg.amountCents, 2500)
  assert.equal(reg.discountCents, 0)
  assert.equal(result.totalOneTimeCents, 2500)
})

test('membership promo applies percent discount to annual fee only', () => {
  const result = computeOrderAdditionalFees({
    fees: [annualFee, regFee],
    lines: feeLines,
    redeemedPeriodKeys: new Set(),
    membershipPromo: {
      rule: {
        id: 43,
        amountType: 'percent',
        amountValue: 5000,
        config: { discountKind: 'amount', amount_applies_to: 'annual_membership' },
      },
      code: 'half',
    },
    now: new Date('2026-06-15').getTime(),
  })

  const annual = result.items.find((i) => i.feeId === 7)
  assert.equal(annual.amountCents, 4250)
  assert.equal(annual.grossAmountCents, 8500)
  assert.equal(annual.discountCents, 4250)
  assert.equal(result.totalOneTimeCents, 4250 + 2500)
})

test('no membership promo leaves fee items unchanged', () => {
  const result = computeOrderAdditionalFees({
    fees: [annualFee],
    lines: feeLines,
    redeemedPeriodKeys: new Set(),
    membershipPromo: null,
    now: new Date('2026-06-15').getTime(),
  })

  const annual = result.items.find((i) => i.feeId === 7)
  assert.equal(annual.amountCents, 8500)
  assert.equal(annual.grossAmountCents, 8500)
  assert.equal(annual.discountCents, 0)
  assert.equal(annual.promoRuleId, null)
})
