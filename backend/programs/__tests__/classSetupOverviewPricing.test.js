import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatResolvedCostSummary,
  resolveClassSetupPricingDisplay,
} from '../classSetupOverview.js'

test('formatResolvedCostSummary formats monthly and class units', () => {
  assert.equal(formatResolvedCostSummary(10000, 'per_month'), '$100.00/mo')
  assert.equal(formatResolvedCostSummary(2500, 'per_class'), '$25.00/class')
  assert.equal(formatResolvedCostSummary(0, 'per_month'), null)
})

test('Class Master shows class override instead of program tier list', () => {
  const display = resolveClassSetupPricingDisplay(
    {
      pricing_cost_options: [
        { key: 'monthly_flat', enabled: true, amountCents: 15000 },
        { key: 'monthly_1x', enabled: true, amountCents: 15000 },
      ],
      pricing_slot_cost_monthly_cents: 15000,
      pricing_cost_unit: 'per_month',
      pricing_cost_amount_cents: 15000,
    },
    {
      pricing_overrides_program: true,
      cost_amount_cents: 10000,
      cost_unit: 'per_month',
      slot_cost_monthly_cents: 10000,
    },
  )

  assert.equal(display.pricingOverridesProgram, true)
  assert.equal(display.costPerMonthSummary, '$100.00/mo')
  assert.equal(display.effectiveCostAmountCents, 10000)
  assert.equal(display.effectiveCostUnit, 'per_month')
})

test('Class Master shows program pricing when class inherits defaults', () => {
  const display = resolveClassSetupPricingDisplay(
    {
      pricing_cost_options: [
        { key: 'monthly_flat', enabled: true, amountCents: 15000 },
        { key: 'monthly_2x', enabled: true, amountCents: 20000 },
      ],
      pricing_slot_cost_monthly_cents: 15000,
      pricing_cost_unit: 'per_month',
      pricing_cost_amount_cents: 15000,
    },
    {
      pricing_overrides_program: false,
      cost_amount_cents: 0,
      cost_unit: 'per_month',
      slot_cost_monthly_cents: 0,
    },
  )

  assert.equal(display.pricingOverridesProgram, false)
  assert.equal(display.costPerMonthSummary, '$150.00/mo · $200.00 (monthly_2x)')
  assert.equal(display.effectiveCostAmountCents, 15000)
})
