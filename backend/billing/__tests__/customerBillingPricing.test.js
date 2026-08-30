import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addBillingMonths,
  adjustmentCoversPeriod,
  applyEnrollmentPriceAdjustment,
  billingMonthInTimeZone,
  enumerateBillingMonths,
  normalizeBillingMonth,
  promoExpirationDate,
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

test('Eastern promo expiration maps to the final eligible billing month and display date', () => {
  const end = '2027-01-01T04:59:59.000Z'
  assert.equal(billingMonthInTimeZone(end), '2026-12-01')
  assert.equal(promoExpirationDate(end), '2027-01-01')
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

test('period pricing stacks distinct assigned promo codes in configured priority order', async () => {
  const adjustments = [
    {
      id: 101,
      signup_id: 501,
      kind: 'promo_code',
      promo_code: 'SAVE10',
      discount_rule_id: 10,
      discount_rule_snapshot: {
        id: 10,
        name: '10% discount',
        type: 'promo_code',
        amountType: 'percent',
        amountValue: 1000,
        applyTo: 'class',
        calcBase: 'pre',
        priority: 10,
        stackable: true,
        config: { code: 'SAVE10' },
      },
      effective_from_month: '2026-08-01',
      effective_through_month: null,
      status: 'active',
      created_at: '2026-08-01T12:00:00.000Z',
    },
    {
      id: 102,
      signup_id: 501,
      kind: 'promo_code',
      promo_code: 'SAVE20',
      discount_rule_id: 20,
      discount_rule_snapshot: {
        id: 20,
        name: '20% discount',
        type: 'promo_code',
        amountType: 'percent',
        amountValue: 2000,
        applyTo: 'class',
        calcBase: 'post',
        priority: 20,
        stackable: true,
        config: { code: 'SAVE20' },
      },
      effective_from_month: '2026-08-01',
      effective_through_month: null,
      status: 'active',
      created_at: '2026-08-02T12:00:00.000Z',
    },
  ]
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (/FROM scheduling_signup/.test(text)) {
        return {
          rows: [{
            id: 501,
            manual_discount_cents: null,
            manual_discount_pct: null,
            manual_discount_rule_id: null,
            manual_discount_reason: null,
          }],
        }
      }
      if (/FROM enrollment_price_adjustment/.test(text)) return { rows: adjustments }
      if (/SELECT id FROM facility LIMIT 1/.test(text)) return { rows: [{ id: 1 }] }
      return { rows: [] }
    },
  }

  const priced = await priceRecurringPeriod(pool, {
    familyId: 77,
    periodKey: '2026-09',
    subscriptions: [{
      id: 88,
      status: 'active',
      source_type: 'scheduling_signup',
      source_id: '501',
      member_id: 900,
      monthly_amount_cents: 10000,
      discount_amount_cents: 0,
      net_monthly_cents: 10000,
      start_date: '2026-08-01',
    }],
  })

  assert.equal(priced.netCents, 7200)
  assert.deepEqual(
    priced.lines[0].discountComponents.map((component) => [component.promoCode, component.amountCents]),
    [['SAVE10', 1000], ['SAVE20', 1800]],
  )
  assert.deepEqual(priced.lines[0].priceAdjustmentIds, [101, 102])
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

test('recurring pricing boundaries derive promo reversion from the immutable rule expiration', () => {
  assert.deepEqual(collectRecurringPricingBoundaries({
    currentMonth: '2026-08',
    adjustments: [{
      kind: 'promo_code',
      effective_from_month: '2026-08-01',
      effective_through_month: null,
      discount_rule_snapshot: { endsAt: '2027-01-01T04:59:59.000Z' },
    }],
  }), ['2026-08', '2027-01'])
})

test('period pricing persists promo before the family tier and removes it after expiration', async () => {
  const promoRule = {
    id: 9,
    active: true,
    name: '50% Off',
    type: 'promo_code',
    amount_type: 'percent',
    amount_value: 5000,
    apply_to: 'order_total',
    calc_base: 'pre',
    priority: 1,
    stackable: true,
    exclusivity_group: null,
    scope_level: 'global',
    scope_ref_id: null,
    starts_at: '2026-01-01T05:00:00.000Z',
    ends_at: '2027-01-01T04:59:59.000Z',
    config: { code: '50OFFVORTEX26' },
  }
  const familyRule = {
    id: 7,
    active: true,
    name: 'Family multi-class spend discount',
    type: 'spend_volume',
    amount_type: 'percent',
    amount_value: 500,
    apply_to: 'order_total',
    calc_base: 'post',
    priority: 100,
    stackable: true,
    exclusivity_group: null,
    scope_level: 'global',
    scope_ref_id: null,
    config: { promo_code: 'SPND-FAMILYMULT', promo_code_auto_generated: true },
  }
  const signups = [96, 97, 98]
  const adjustments = signups.map((signupId, index) => ({
    id: index + 4,
    signup_id: signupId,
    kind: 'promo_code',
    promo_code: '50OFFVORTEX26',
    discount_rule_id: 9,
    discount_rule_snapshot: {
      id: 9,
      name: '50% Off',
      type: 'promo_code',
      amountType: 'percent',
      amountValue: 5000,
      applyTo: 'order_total',
      calcBase: 'pre',
      priority: 1,
      stackable: true,
      startsAt: promoRule.starts_at,
      endsAt: promoRule.ends_at,
      config: { code: '50OFFVORTEX26' },
    },
    effective_from_month: '2026-08-01',
    effective_through_month: '2026-12-01',
    status: 'active',
    created_at: `2026-08-30T12:00:0${index}.000Z`,
  }))
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (/FROM scheduling_signup/.test(text)) {
        return { rows: signups.map((id) => ({
          id,
          manual_discount_cents: null,
          manual_discount_pct: 50,
          manual_discount_rule_id: 9,
          manual_discount_reason: 'Original enrollment used promo code 50OFFVORTEX26',
        })) }
      }
      if (/FROM enrollment_price_adjustment/.test(text)) return { rows: adjustments }
      if (/SELECT id FROM facility LIMIT 1/.test(text)) return { rows: [{ id: 1 }] }
      if (/SELECT \* FROM discount_rule\s/.test(text)) return { rows: [promoRule, familyRule] }
      if (/FROM discount_rule_tier/.test(text)) {
        return { rows: [
          { rule_id: 7, threshold: 15000, amount_type: 'percent', amount_value: 500, min_paid_enrollments: 2 },
          { rule_id: 7, threshold: 45000, amount_type: 'percent', amount_value: 2000, min_paid_enrollments: 3 },
        ] }
      }
      return { rows: [] }
    },
  }
  const subscriptions = signups.map((signupId, index) => ({
    id: index + 27,
    status: 'active',
    source_type: 'scheduling_signup',
    source_id: String(signupId),
    member_id: 74,
    monthly_amount_cents: 15000,
    discount_amount_cents: 7875,
    net_monthly_cents: 7125,
    start_date: '2026-08-01',
  }))

  const september = await priceRecurringPeriod(pool, {
    familyId: 48,
    subscriptions,
    periodKey: '2026-09',
  })
  assert.equal(september.grossCents, 45000)
  assert.equal(september.discountCents, 23625)
  assert.equal(september.netCents, 21375)
  assert.deepEqual(september.lines.map((line) => line.netCents), [7125, 7125, 7125])
  assert.deepEqual(
    september.lines[0].discountComponents.map((component) => [component.ruleId, component.amountCents]),
    [[9, 7500], [7, 375]],
  )
  assert.equal(september.lines[0].discountComponents[0].promoCode, '50OFFVORTEX26')
  assert.equal(september.lines[0].discountComponents[0].expiresOn, '2027-01-01')

  const january = await priceRecurringPeriod(pool, {
    familyId: 48,
    subscriptions,
    periodKey: '2027-01',
  })
  assert.equal(january.discountCents, 9000)
  assert.equal(january.netCents, 36000)
  assert.deepEqual(january.lines.map((line) => line.netCents), [12000, 12000, 12000])
  assert.equal(january.lines.some((line) => line.discountComponents.some((component) => component.ruleId === 9)), false)
})
