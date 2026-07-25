import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateManualChargeInput,
  validateManualPaymentInput,
} from '../billingManualControls.js'

test('manual credits must be negative and refund is not a charge type', () => {
  assert.throws(
    () => validateManualChargeInput({ description: 'Courtesy credit', amountCents: 2500, chargeType: 'credit', createdByUserId: 4 }),
    /negative amount/i,
  )
  assert.throws(
    () => validateManualChargeInput({ description: 'Refund', amountCents: -2500, chargeType: 'refund', createdByUserId: 4 }),
    /invalid manual charge type/i,
  )
  const credit = validateManualChargeInput({
    description: ' Courtesy credit ',
    amountCents: -2500,
    chargeType: 'credit',
    createdByUserId: 4,
  })
  assert.deepEqual(credit, {
    description: 'Courtesy credit',
    amount: -2500,
    chargeType: 'credit',
    gross: -2500,
    discount: 0,
    createdByUserId: 4,
  })
})

test('manual charge pricing must reconcile gross, discount, and net', () => {
  assert.throws(
    () =>
      validateManualChargeInput({
        description: 'Camp fee',
        amountCents: 8000,
        grossAmountCents: 10000,
        discountAmountCents: 1000,
        chargeType: 'one_time',
        createdByUserId: 4,
      }),
    /net amount must equal/i,
  )
})

test('manual charges require authenticated creator attribution', () => {
  assert.throws(
    () => validateManualChargeInput({ description: 'Camp fee', amountCents: 8000, chargeType: 'one_time' }),
    /creator identity/i,
  )
})

test('manual payments require method, note, and authenticated recorder', () => {
  assert.throws(
    () => validateManualPaymentInput({ amountCents: 5000, method: '', note: 'Cash at desk', recordedByUserId: 4 }),
    /method is required/i,
  )
  assert.throws(
    () => validateManualPaymentInput({ amountCents: 5000, method: 'cash', note: '', recordedByUserId: 4 }),
    /note is required/i,
  )
  assert.throws(
    () => validateManualPaymentInput({ amountCents: 5000, method: 'cash', note: 'Cash at desk', recordedByUserId: null }),
    /recorder identity/i,
  )
})
