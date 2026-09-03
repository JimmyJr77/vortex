import test from 'node:test'
import assert from 'node:assert/strict'
import {
  familyAutopayScheduled,
  lastThreeBillingMonths,
  yearToDateBounds,
} from '../customerBillingOverviewList.js'

test('last three billing months are the completed months before the current billing month', () => {
  assert.deepEqual(
    lastThreeBillingMonths(new Date('2026-09-03T16:00:00.000Z')),
    ['2026-06', '2026-07', '2026-08'],
  )
})

test('year-to-date bounds start on January 1 of the billing year', () => {
  const bounds = yearToDateBounds(new Date('2026-09-03T16:00:00.000Z'))
  assert.equal(bounds.year, '2026')
  assert.equal(bounds.start, '2026-01-01')
})

test('autopay is scheduled when household monthly billing has a card on file', () => {
  assert.equal(familyAutopayScheduled({
    householdMonthlyBillingEnabled: true,
    cardOnFile: true,
    hasLegacyStripeSubscription: false,
  }), true)
})

test('autopay is not scheduled when household monthly billing still needs a card', () => {
  assert.equal(familyAutopayScheduled({
    householdMonthlyBillingEnabled: true,
    cardOnFile: false,
    hasLegacyStripeSubscription: false,
  }), false)
})

test('legacy Stripe subscriptions still count as scheduled autopay', () => {
  assert.equal(familyAutopayScheduled({
    householdMonthlyBillingEnabled: false,
    cardOnFile: false,
    hasLegacyStripeSubscription: true,
  }), true)
})
