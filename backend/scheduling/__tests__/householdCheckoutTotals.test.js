import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveHouseholdCheckoutMonthlyTotals } from '../orderPricing.js'

test('household checkout total uses full account list minus household discount', () => {
  // Maddox 2×$150 + Cannon $150 = $450; 20% family spend = $90 → $360
  const result = resolveHouseholdCheckoutMonthlyTotals({
    existingMonthlyTotal: 300,
    newSignupMonthlyTotal: 150,
    engineDiscountMonthly: 90,
  })
  assert.equal(result.monthlySubtotal, 450)
  assert.equal(result.estimatedMonthlyTotal, 360)
})

test('household checkout total does not subtract discount from cart-only subtotal', () => {
  // Regression: $150 cart − $90 household discount must not become $60
  const buggyCartOnly = 150 - 90
  assert.equal(buggyCartOnly, 60)
  const result = resolveHouseholdCheckoutMonthlyTotals({
    existingMonthlyTotal: 300,
    newSignupMonthlyTotal: 150,
    engineDiscountMonthly: 90,
  })
  assert.notEqual(result.estimatedMonthlyTotal, buggyCartOnly)
  assert.equal(result.estimatedMonthlyTotal, 360)
})
