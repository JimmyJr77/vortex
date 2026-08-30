import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addBillingMonths,
  adjustmentCoversPeriod,
  applyEnrollmentPriceAdjustment,
  enumerateBillingMonths,
  normalizeBillingMonth,
} from '../customerBillingPricing.js'
import { collectRecurringPricingBoundaries, priceRecurringPeriod } from '../recurringPeriodPricing.js'

test('billing month helpers normalize month boundaries and enumerate inclusively', () => {
  assert.equal(normalizeBillingMonth('2026-08'), '2026-08-01')
  assert.equal(normalizeBillingMonth('2026-08-19'), '2026-08-01')
  assert.equal(normalizeBillingMonth('2026-08-19T14:22:00.000Z'), '2026-08-01')
  assert.equal(addBillingMonths('2026-12', 1), '2027-01-01')
  assert.deepEqual(enumerateBillingMonths('2026-08', '2026-10'), ['2026-08', '2026-09', '2026-10'])
})

test('effective-dated adjustment window includes both selected boundary months', () => {
  const adjustment = {
    effective_from_month: '2026-08-01',
    effective_through_month: '2026-10-01',
  }
  assert.equal(adjustmentCoversPeriod(adjustment, '2026-07'), false)
  assert.equal(adjustmentCoversPeriod(adjustment, '2026-08'), true)
  assert.equal(adjustmentCoversPeriod(adjustment, '2026-10'), true)
  assert.equal(adjustmentCoversPeriod(adjustment, '2026-11'), false)
})

test('fixed final price wins after automatic discounts and allows zero', () => {
  const resolved = applyEnrollmentPriceAdjustment(
    { grossCents: 10000, netCents: 8500 },
    { id: 12, kind: 'fixed_final_price', final_price_cents: 0 },
  )
  assert.equal(resolved.automaticDiscountCents, 1500)
  assert.equal(resolved.manualAdjustmentCents, 8500)
  assert.equal(resolved.netCents, 0)
  assert.equal(resolved.discountCents, 10000)
})

test('fixed final price can be an above-list surcharge without changing automatic explanation', () => {
  const resolved = applyEnrollmentPriceAdjustment(
    { grossCents: 10000, netCents: 8500 },
    { id: 13, kind: 'fixed_final_price', final_price_cents: 12000 },
  )
  assert.equal(resolved.automaticDiscountCents, 1500)
  assert.equal(resolved.manualAdjustmentCents, -3500)
  assert.equal(resolved.netCents, 12000)
  assert.equal(resolved.discountCents, -2000)
})

test('promo adjustment applies its immutable rule snapshot after automatic pricing', () => {
  const resolved = applyEnrollmentPriceAdjustment(
    { grossCents: 10000, netCents: 9000 },
    {
      id: 14,
      kind: 'promo_code',
      discount_rule_snapshot: {
        amountType: 'percent',
        amountValue: 1000,
        calcBase: 'pre',
        config: {},
      },
    },
  )
  assert.equal(resolved.automaticDiscountCents, 1000)
  assert.equal(resolved.manualAdjustmentCents, 1000)
  assert.equal(resolved.netCents, 8000)
})

test('free-access promo snapshot resolves tuition to zero', () => {
  const resolved = applyEnrollmentPriceAdjustment(
    { grossCents: 10000, netCents: 8750 },
    {
      id: 15,
      kind: 'promo_code',
      discount_rule_snapshot: {
        amountType: 'percent',
        amountValue: 0,
        config: { discountKind: 'free_access' },
      },
    },
  )
  assert.equal(resolved.netCents, 0)
  assert.equal(resolved.manualAdjustmentCents, 8750)
})

test('period pricing retains non-enrollment monthly charges and excludes annual memberships', async () => {
  const result = await priceRecurringPeriod(
    { query: async () => ({ rows: [] }) },
    {
      familyId: 42,
      periodKey: '2026-08',
      subscriptions: [
        {
          id: 1,
          status: 'active',
          source_type: 'monthly_fee',
          monthly_amount_cents: 2500,
          discount_amount_cents: 500,
          net_monthly_cents: 2000,
          start_date: '2026-01-01',
        },
        {
          id: 2,
          status: 'active',
          source_type: 'annual_membership',
          monthly_amount_cents: 10000,
          net_monthly_cents: 10000,
        },
        {
          id: 3,
          status: 'active',
          source_type: 'monthly_fee',
          monthly_amount_cents: 3000,
          net_monthly_cents: 3000,
          start_date: '2026-09-01',
        },
      ],
    },
  )

  assert.equal(result.grossCents, 2500)
  assert.equal(result.discountCents, 500)
  assert.equal(result.netCents, 2000)
  assert.deepEqual(result.lines.map((line) => line.subscriptionId), [1])
})

test('recurring pricing boundaries include future starts and adjustment reversion months', () => {
  assert.deepEqual(collectRecurringPricingBoundaries({
    currentMonth: '2026-08',
    subscriptions: [
      { id: 1, status: 'active', source_type: 'scheduling_signup', next_bill_date: '2026-08-01' },
      { id: 2, status: 'active', source_type: 'scheduling_signup', start_date: '2026-10-01' },
    ],
    adjustments: [{ effective_from_month: '2026-09-01', effective_through_month: '2026-11-01' }],
  }), ['2026-08', '2026-09', '2026-10', '2026-12'])
})
