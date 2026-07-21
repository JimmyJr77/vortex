import test from 'node:test'
import assert from 'node:assert/strict'
import { paymentAmountsMismatch } from '../stripeReconciliation.js'

test('reconciliation treats numeric database strings and Stripe integers as equal',()=>{
  assert.equal(paymentAmountsMismatch('2500',2500),false)
  assert.equal(paymentAmountsMismatch(2499,2500),true)
})
