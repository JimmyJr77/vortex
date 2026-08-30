import test from 'node:test'
import assert from 'node:assert/strict'
import { paymentAmountsMismatch, subscriptionScheduleHasDrift } from '../stripeReconciliation.js'

test('reconciliation treats numeric database strings and Stripe integers as equal',()=>{
  assert.equal(paymentAmountsMismatch('2500',2500),false)
  assert.equal(paymentAmountsMismatch(2499,2500),true)
})

test('reconciliation detects Stripe phase amount, boundary, and count drift', () => {
  const expected = [
    { periodKey: '2026-08', amountCents: 10000, endPeriodKey: '2026-10' },
    { periodKey: '2026-10', amountCents: 8000, endPeriodKey: null },
  ]
  assert.equal(subscriptionScheduleHasDrift(expected, expected), false)
  assert.equal(subscriptionScheduleHasDrift(expected, [
    expected[0],
    { ...expected[1], amountCents: 8100 },
  ]), true)
  assert.equal(subscriptionScheduleHasDrift(expected, [expected[0]]), true)
  assert.equal(subscriptionScheduleHasDrift(expected, [
    { ...expected[0], endPeriodKey: '2026-11' },
    expected[1],
  ]), true)
})
