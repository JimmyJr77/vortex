import test from 'node:test'
import assert from 'node:assert/strict'
import { computeOrderDiscounts } from '../discountEngine.js'
import { computeAccountStats, pickMonthlySpendTier } from '../systemDiscounts.js'

const spendRule = {
  id: 1,
  name: 'Family multi-class spend discount',
  type: 'spend_volume',
  active: true,
  amountType: 'percent',
  amountValue: 0,
  calcBase: 'pre',
  priority: 55,
  stackable: true,
  exclusivityGroup: 'monthly_spend',
  config: {
    system_key: 'monthly_spend',
    min_paying_classes: 2,
    discount_target: 'total',
  },
  tiers: [
    { threshold: 30000, amountType: 'percent', amountValue: 1500, minPaidEnrollments: 2 },
    { threshold: 25000, amountType: 'percent', amountValue: 1000, minPaidEnrollments: 2 },
    { threshold: 15000, amountType: 'percent', amountValue: 500, minPaidEnrollments: 2 },
  ],
}

test('pickMonthlySpendTier selects 15% at $300 with 2 paid classes', () => {
  const stats = computeAccountStats([
    { listCents: 15000, finalCents: 15000, baseCents: 15000 },
    { listCents: 15000, finalCents: 15000, baseCents: 15000 },
  ])
  assert.equal(stats.paidClassCount, 2)
  assert.equal(stats.accountMonthlyCents, 30000)
  const tier = pickMonthlySpendTier(spendRule, stats)
  assert.equal(tier.amountValue, 1500)
})

test('pickMonthlySpendTier selects 5% at $150 with 2 paid classes', () => {
  const stats = computeAccountStats([
    { listCents: 7500, finalCents: 7500, baseCents: 7500 },
    { listCents: 7500, finalCents: 7500, baseCents: 7500 },
  ])
  assert.equal(stats.paidClassCount, 2)
  assert.equal(stats.accountMonthlyCents, 15000)
  const tier = pickMonthlySpendTier(spendRule, stats)
  assert.equal(tier.amountValue, 500)
})

test('computeOrderDiscounts applies 15% household discount on $300 existing + new', () => {
  const shadowLine = {
    key: 'account-db-101',
    signupId: 101,
    formId: 10,
    programId: 1,
    memberId: 1,
    familyId: 1,
    baseCents: 15000,
    listCents: 15000,
    finalCents: 15000,
    includeInSubtotal: false,
    shadowOnly: true,
    accountPaidClassCount: 2,
    accountMonthlyCents: 30000,
  }
  const cartLine = {
    key: 'new-slot',
    formId: 11,
    programId: 2,
    memberId: 1,
    familyId: 1,
    baseCents: 15000,
    listCents: 15000,
    finalCents: 15000,
    includeInSubtotal: true,
    accountPaidClassCount: 2,
    accountMonthlyCents: 30000,
  }
  const allLines = [shadowLine, cartLine]
  shadowLine.accountAllLines = allLines
  cartLine.accountAllLines = allLines

  const result = computeOrderDiscounts({
    lines: [cartLine, shadowLine],
    rules: [spendRule],
    promoCodes: [],
    caps: {},
  })

  assert.equal(result.totalDiscountCents, 4500)
  assert.equal(result.orderDiscounts.length, 1)
  assert.equal(result.orderDiscounts[0].amountCents, 4500)
  assert.equal(result.orderDiscounts[0].name, spendRule.name)
})

test('computeOrderDiscounts under-discounts when account spend stats omit existing class', () => {
  const shadowLine = {
    key: 'account-db-101',
    signupId: 101,
    formId: 10,
    programId: 1,
    memberId: 1,
    familyId: 1,
    baseCents: 15000,
    listCents: 15000,
    finalCents: 15000,
    includeInSubtotal: false,
    shadowOnly: true,
    accountPaidClassCount: 2,
    accountMonthlyCents: 15000,
  }
  const cartLine = {
    key: 'new-slot',
    formId: 11,
    programId: 2,
    memberId: 1,
    familyId: 1,
    baseCents: 15000,
    includeInSubtotal: true,
    accountPaidClassCount: 2,
    accountMonthlyCents: 15000,
  }
  const allLines = [shadowLine, cartLine]
  shadowLine.accountAllLines = allLines
  cartLine.accountAllLines = allLines

  const result = computeOrderDiscounts({
    lines: [cartLine, shadowLine],
    rules: [spendRule],
    promoCodes: [],
    caps: {},
  })

  assert.equal(result.totalDiscountCents, 1500)
})
