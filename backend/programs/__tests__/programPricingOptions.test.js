import test from 'node:test'
import assert from 'node:assert/strict'

import {
  deriveLegacyPricingFromOptions,
  hydrateProgramPricingOptionsFromLegacy,
} from '../programPricingOptions.js'

test('legacy per-month pricing hydrates as a flat monthly fee', () => {
  const options = hydrateProgramPricingOptionsFromLegacy({
    pricing_cost_options: [],
    pricing_slot_cost_monthly_cents: 12500,
    pricing_cost_unit: 'per_month',
  })

  const enabled = options.filter((option) => option.enabled)
  assert.deepEqual(enabled, [
    { key: 'monthly_flat', enabled: true, amountCents: 12500 },
  ])
})

test('flat monthly pricing remains compatible with legacy cost columns', () => {
  const legacy = deriveLegacyPricingFromOptions([
    { key: 'monthly_flat', enabled: true, amountCents: 12500 },
  ])

  assert.deepEqual(legacy, {
    pricingSlotCostMonthlyCents: 12500,
    pricingCostUnit: 'per_month',
    pricingCostAmountCents: 12500,
  })
})
