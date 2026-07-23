import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateDropInAvailability, calculateDropInPrice } from '../dropIns.js'

test('non-member drop-in is monthly tuition divided by three', () => {
  assert.deepEqual(calculateDropInPrice({ monthlyCents: 15000, annualMember: false }), {
    baseCents: 5000,
    discountPercent: 0,
    discountCents: 0,
    totalCents: 5000,
  })
})

test('annual member drop-in is monthly tuition divided by four with existing discount', () => {
  assert.deepEqual(calculateDropInPrice({ monthlyCents: 16000, annualMember: true, discountPercent: 25 }), {
    baseCents: 4000,
    discountPercent: 25,
    discountCents: 1000,
    totalCents: 3000,
  })
})

test('free benefits retain the price breakdown but charge zero', () => {
  assert.equal(calculateDropInPrice({ monthlyCents: 12000, annualMember: true, discountPercent: 10, isFree: true }).totalCents, 0)
})

test('non-members do not receive an account discount', () => {
  assert.equal(calculateDropInPrice({ monthlyCents: 12000, annualMember: false, discountPercent: 50 }).discountPercent, 0)
})

test('monthly enrollments establish the drop-in capacity baseline', () => {
  assert.deepEqual(calculateDropInAvailability({ maxParticipants: 10, monthlyEnrolled: 7, dropInEnrolled: 2 }), {
    monthlyEnrolled: 7,
    dropInEnrolled: 2,
    totalAttending: 9,
    spotsRemaining: 1,
    isFull: false,
  })
})

test('monthly over-enrollment is allowed but leaves no drop-in capacity', () => {
  assert.deepEqual(calculateDropInAvailability({ maxParticipants: 10, monthlyEnrolled: 12, dropInEnrolled: 0 }), {
    monthlyEnrolled: 12,
    dropInEnrolled: 0,
    totalAttending: 12,
    spotsRemaining: 0,
    isFull: true,
  })
})
