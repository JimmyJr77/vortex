import test from 'node:test'
import assert from 'node:assert/strict'
import { billingTypeForCostUnit, buildReceiptPricingSummary } from '../pricing.js'

test('per_class and per_offering classify as one-time', () => {
  assert.equal(billingTypeForCostUnit('per_class'), 'one_time')
  assert.equal(billingTypeForCostUnit('per_offering'), 'one_time')
})

test('per_month / per_hour / unknown / null classify as recurring', () => {
  assert.equal(billingTypeForCostUnit('per_month'), 'recurring')
  assert.equal(billingTypeForCostUnit('per_hour'), 'recurring')
  assert.equal(billingTypeForCostUnit(null), 'recurring')
  assert.equal(billingTypeForCostUnit(undefined), 'recurring')
})

test('buildReceiptPricingSummary returns null when there is no pricing', () => {
  assert.equal(buildReceiptPricingSummary(null), null)
  assert.equal(buildReceiptPricingSummary({ hasPricing: false }), null)
})

test('buildReceiptPricingSummary converts dollars to cents and splits gross/discount/net', () => {
  const summary = buildReceiptPricingSummary({
    hasPricing: true,
    costUnit: 'per_month',
    totalSlots: 2,
    nonDiscountedMonthly: 250,
    discountMonthly: 25,
    discountedMonthly: 225,
    hoursPerSlotMonthly: 4,
  })
  assert.equal(summary.billingType, 'recurring')
  assert.equal(summary.billingLabel, 'Monthly (recurring)')
  assert.equal(summary.costUnit, 'per_month')
  assert.equal(summary.totalSlots, 2)
  assert.equal(summary.nonDiscountedCents, 25000)
  assert.equal(summary.discountCents, 2500)
  assert.equal(summary.netCents, 22500)
  assert.equal(summary.hoursPerSlotMonthly, 4)
})

test('buildReceiptPricingSummary labels one-time purchases correctly', () => {
  const summary = buildReceiptPricingSummary({
    hasPricing: true,
    costUnit: 'per_class',
    totalSlots: 1,
    nonDiscountedMonthly: 30,
    discountMonthly: 0,
    discountedMonthly: 30,
    hoursPerSlotMonthly: null,
  })
  assert.equal(summary.billingType, 'one_time')
  assert.equal(summary.billingLabel, 'One-time')
  assert.equal(summary.netCents, 3000)
  assert.equal(summary.hoursPerSlotMonthly, null)
})
