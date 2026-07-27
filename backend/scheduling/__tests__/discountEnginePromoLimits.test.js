import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeOrderDiscounts,
  promoTargetsMembershipFee,
  membershipPromoDiscountCents,
  freeGrantDurationMonths,
  freeGrantDurationWeeks,
} from '../discountEngine.js'
import { deferredFirstBillDate } from '../billingSubscriptions.js'

function promoRule(overrides = {}) {
  return {
    id: 1,
    name: '10 off',
    type: 'promo_code',
    amountType: 'percent',
    amountValue: 1000,
    applyTo: 'per_class',
    calcBase: 'pre',
    priority: 100,
    stackable: true,
    exclusivityGroup: null,
    maxDiscountCents: null,
    scopeLevel: 'global',
    scopeRefId: null,
    startsAt: null,
    endsAt: null,
    maxRedemptions: null,
    redeemedCount: 0,
    active: true,
    config: { code: 'SAVE10', discountKind: 'amount' },
    tiers: [],
    ...overrides,
  }
}

function line(key, memberId = 5, familyId = 9) {
  return {
    key,
    formId: 1,
    programId: 1,
    sportId: 1,
    offeringId: null,
    memberId,
    familyId,
    baseCents: 10000,
    listCents: 10000,
    finalCents: 10000,
    includeInSubtotal: true,
  }
}

test('per-member limit blocks promo once member DB count is at the cap', () => {
  const rule = promoRule({ config: { code: 'SAVE10', discountKind: 'amount', max_redemptions_per_member: 1 } })
  const result = computeOrderDiscounts({
    lines: [line('a')],
    rules: [rule],
    promoCodes: ['SAVE10'],
    caps: { ruleMemberRedeemed: { 1: 1 } },
  })
  assert.equal(result.totalDiscountCents, 0)
})

test('per-member limit caps in-order redemptions', () => {
  const rule = promoRule({ config: { code: 'SAVE10', discountKind: 'amount', max_redemptions_per_member: 1 } })
  const result = computeOrderDiscounts({
    lines: [line('a'), line('b')],
    rules: [rule],
    promoCodes: ['SAVE10'],
    caps: {},
  })
  // Only one of the two lines may redeem.
  assert.equal(result.totalDiscountCents, 1000)
})

test('per-family limit blocks promo once family DB count is at the cap', () => {
  const rule = promoRule({ config: { code: 'SAVE10', discountKind: 'amount', max_redemptions_per_family: 2 } })
  const result = computeOrderDiscounts({
    lines: [line('a')],
    rules: [rule],
    promoCodes: ['SAVE10'],
    caps: { ruleFamilyRedeemed: { 1: 2 } },
  })
  assert.equal(result.totalDiscountCents, 0)
})

test('promo without limits applies to every line', () => {
  const rule = promoRule()
  const result = computeOrderDiscounts({
    lines: [line('a'), line('b')],
    rules: [rule],
    promoCodes: ['SAVE10'],
    caps: {},
  })
  assert.equal(result.totalDiscountCents, 2000)
})

test('membership-fee promos are excluded from class tuition lines', () => {
  const rule = promoRule({
    amountValue: 10000,
    config: { code: 'FREEMEM', discountKind: 'free_access', benefit_type: 'annual_membership' },
  })
  assert.equal(promoTargetsMembershipFee(rule), true)
  const result = computeOrderDiscounts({
    lines: [line('a')],
    rules: [rule],
    promoCodes: ['FREEMEM'],
    caps: {},
  })
  assert.equal(result.totalDiscountCents, 0)
})

test('freeGrantDurationMonths converts classes/months to full billing months', () => {
  const free = (config) => promoRule({ config: { code: 'X', discountKind: 'free_access', ...config } })
  // 4 classes = 1 month, 12 classes = 3 months, partial rounds up.
  assert.equal(freeGrantDurationMonths(free({ benefit_type: 'solo_classes', quantity: 4 })), 1)
  assert.equal(freeGrantDurationMonths(free({ benefit_type: 'solo_classes', quantity: 12 })), 3)
  assert.equal(freeGrantDurationMonths(free({ benefit_type: 'solo_classes', quantity: 6 })), 2)
  assert.equal(freeGrantDurationMonths(free({ benefit_type: 'months', quantity: 3 })), 3)
  // Weeks are handled by freeGrantDurationWeeks, not converted to months.
  assert.equal(freeGrantDurationMonths(free({ benefit_type: 'weeks', quantity: 8 })), null)
  assert.equal(freeGrantDurationWeeks(free({ benefit_type: 'weeks', quantity: 8 })), 8)
  assert.equal(freeGrantDurationWeeks(free({ benefit_type: 'months', quantity: 2 })), null)
  // Open-ended benefits have no duration.
  assert.equal(freeGrantDurationMonths(free({ benefit_type: 'program_duration' })), null)
  assert.equal(freeGrantDurationMonths(free({ benefit_type: 'class_offering', quantity: 1 })), null)
  // Non-free rules have no duration.
  assert.equal(freeGrantDurationMonths(promoRule()), null)
  assert.equal(freeGrantDurationWeeks(promoRule()), null)
})

test('free grant carries freeDurationMonths on applied entries and freeGrants', () => {
  const rule = promoRule({
    amountValue: 10000,
    config: { code: 'MONTHFREE', discountKind: 'free_access', benefit_type: 'months', quantity: 1 },
  })
  const result = computeOrderDiscounts({
    lines: [line('a')],
    rules: [rule],
    promoCodes: ['MONTHFREE'],
    caps: {},
  })
  assert.equal(result.lines[0].finalCents, 0)
  const applied = result.lines[0].applied.find((a) => a.kind === 'free')
  assert.equal(applied.freeDurationMonths, 1)
  assert.equal(applied.freeDurationWeeks, null)
  assert.equal(result.freeGrants[0].durationMonths, 1)
})

test('weeks free grant carries freeDurationWeeks (no month conversion)', () => {
  const rule = promoRule({
    amountValue: 10000,
    config: { code: 'WEEKSFREE', discountKind: 'free_access', benefit_type: 'weeks', quantity: 2 },
  })
  const result = computeOrderDiscounts({
    lines: [line('a')],
    rules: [rule],
    promoCodes: ['WEEKSFREE'],
    caps: {},
  })
  assert.equal(result.lines[0].finalCents, 0)
  const applied = result.lines[0].applied.find((a) => a.kind === 'free')
  assert.equal(applied.freeDurationMonths, null)
  assert.equal(applied.freeDurationWeeks, 2)
  assert.equal(result.freeGrants[0].durationWeeks, 2)
})

test('program_duration free grant is open-ended (null duration)', () => {
  const rule = promoRule({
    amountValue: 10000,
    config: { code: 'FOREVER', discountKind: 'free_access', benefit_type: 'program_duration' },
  })
  const result = computeOrderDiscounts({
    lines: [line('a')],
    rules: [rule],
    promoCodes: ['FOREVER'],
    caps: {},
  })
  assert.equal(result.lines[0].finalCents, 0)
  const applied = result.lines[0].applied.find((a) => a.kind === 'free')
  assert.equal(applied.freeDurationMonths, null)
  assert.equal(result.freeGrants[0].durationMonths, null)
})

test('deferredFirstBillDate: N free months = enrollment stub + N full months', () => {
  const fromDate = new Date(Date.UTC(2026, 6, 27)) // Jul 27
  // 1 free month → rest of July free + all of August; billing starts Sep 1.
  assert.equal(deferredFirstBillDate({ fromDate, freeMonths: 1 }), '2026-09-01')
  // 3 free months → Jul stub + Aug + Sep + Oct free; first bill Nov 1.
  assert.equal(deferredFirstBillDate({ fromDate, freeMonths: 3 }), '2026-11-01')
  // Future-start class: prepaid first service month + N full months from its firstBillDate.
  assert.equal(
    deferredFirstBillDate({ fromDate, firstBillDate: '2026-10-01', freeMonths: 2 }),
    '2026-12-01',
  )
})

test('deferredFirstBillDate: N free weeks → first 1st-of-month after the window', () => {
  const fromDate = new Date(Date.UTC(2026, 6, 27)) // Jul 27
  // 2 weeks free (through Aug 9) → August cannot be partially billed → Sep 1.
  assert.equal(deferredFirstBillDate({ fromDate, freeWeeks: 2 }), '2026-09-01')
  // 1 week starting Jul 25 ends exactly on Aug 1 → normal anchor.
  assert.equal(
    deferredFirstBillDate({ fromDate: new Date(Date.UTC(2026, 6, 25)), freeWeeks: 1 }),
    '2026-08-01',
  )
  // 6 weeks free (through Sep 6) → first bill Oct 1.
  assert.equal(deferredFirstBillDate({ fromDate, freeWeeks: 6 }), '2026-10-01')
  // Future-start class counts weeks from the first service day.
  assert.equal(
    deferredFirstBillDate({
      fromDate,
      firstBillDate: '2026-11-01',
      freeWeeks: 2,
      weeksFrom: '2026-10-05',
    }),
    '2026-11-01',
  )
  assert.equal(
    deferredFirstBillDate({
      fromDate,
      firstBillDate: '2026-11-01',
      freeWeeks: 6,
      weeksFrom: '2026-10-05',
    }),
    '2026-12-01',
  )
  // Stacked grants: the later of months vs weeks wins.
  assert.equal(deferredFirstBillDate({ fromDate, freeMonths: 1, freeWeeks: 2 }), '2026-09-01')
  assert.equal(deferredFirstBillDate({ fromDate, freeMonths: 2, freeWeeks: 2 }), '2026-10-01')
})

test('membershipPromoDiscountCents waives full fee for free_access and discounts for amount rules', () => {
  const waive = promoRule({
    config: { code: 'FREEMEM', discountKind: 'free_access', benefit_type: 'annual_membership' },
  })
  assert.equal(membershipPromoDiscountCents(waive, 8500), 8500)

  const half = promoRule({
    amountType: 'percent',
    amountValue: 5000,
    config: { code: 'HALF', discountKind: 'amount', amount_applies_to: 'annual_membership' },
  })
  assert.equal(membershipPromoDiscountCents(half, 8500), 4250)

  const fixed = promoRule({
    amountType: 'fixed',
    amountValue: 2000,
    config: { code: 'TWENTY', discountKind: 'amount', amount_applies_to: 'annual_membership' },
  })
  assert.equal(membershipPromoDiscountCents(fixed, 8500), 2000)
})
