import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  familyAutopayStatus,
  familyAutopayScheduled,
  lastThreeBillingMonths,
  paymentMethodReadyForBillingMonth,
  yearToDateBounds,
} from '../customerBillingOverviewList.js'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const overviewSource = fs.readFileSync(
  path.join(testDirectory, '../customerBillingOverviewList.js'),
  'utf8',
)

test('monthly paid totals follow settled charge applications instead of payment dates', () => {
  assert.match(overviewSource, /FROM billing_payment_application application/)
  assert.match(overviewSource, /FROM billing_charge_credit_application application/)
  assert.match(overviewSource, /payment\.paid_cents, 0\) \+ COALESCE\(credit\.credit_cents, 0\)/)
  assert.match(overviewSource, /customerAuditVisibility', ''\) <> 'suppressed'/)
  assert.doesNotMatch(
    overviewSource,
    /to_char\(payment\.paid_at AT TIME ZONE \$4::text, 'YYYY-MM'\) AS billing_month/,
  )
})

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
    hasVerifiedHouseholdMigration: true,
    effectiveCollectionMonth: '2026-10-01',
    billingMonth: '2026-10-01',
  }), true)
})

test('autopay is not scheduled when household monthly billing still needs a card', () => {
  assert.equal(familyAutopayScheduled({
    householdMonthlyBillingEnabled: true,
    cardOnFile: false,
    hasLegacyStripeSubscription: false,
    hasVerifiedHouseholdMigration: true,
    effectiveCollectionMonth: '2026-10-01',
    billingMonth: '2026-10-01',
  }), false)
})

test('legacy Stripe subscriptions are a household-autopay conflict, never a ready state', () => {
  assert.equal(familyAutopayScheduled({
    householdMonthlyBillingEnabled: false,
    cardOnFile: false,
    hasLegacyStripeSubscription: true,
    hasVerifiedHouseholdMigration: false,
    effectiveCollectionMonth: null,
    billingMonth: '2026-10-01',
  }), false)
  assert.equal(familyAutopayStatus({
    householdMonthlyBillingEnabled: true,
    cardOnFile: true,
    hasLegacyStripeSubscription: true,
    hasVerifiedHouseholdMigration: true,
    effectiveCollectionMonth: '2026-10-01',
    billingMonth: '2026-10-01',
  }), 'legacy_collector_conflict')
})

test('households without billable recurring tuition do not need an autopay migration', () => {
  assert.equal(familyAutopayStatus({
    householdMonthlyBillingEnabled: false,
    cardOnFile: false,
    hasLegacyStripeSubscription: false,
    hasVerifiedHouseholdMigration: false,
    effectiveCollectionMonth: null,
    billingMonth: '2026-10-01',
    requiresHouseholdAutopay: false,
  }), 'not_applicable')

  assert.equal(familyAutopayStatus({
    householdMonthlyBillingEnabled: false,
    cardOnFile: false,
    hasLegacyStripeSubscription: true,
    hasVerifiedHouseholdMigration: false,
    effectiveCollectionMonth: null,
    billingMonth: '2026-10-01',
    requiresHouseholdAutopay: false,
  }), 'legacy_collector_conflict')
})

test('a card and household flag without verified migration evidence are not autopay', () => {
  assert.equal(familyAutopayStatus({
    householdMonthlyBillingEnabled: true,
    cardOnFile: true,
    hasLegacyStripeSubscription: false,
    hasVerifiedHouseholdMigration: false,
    effectiveCollectionMonth: null,
    billingMonth: '2026-10-01',
  }), 'migration_required')
  assert.equal(familyAutopayStatus({
    householdMonthlyBillingEnabled: true,
    cardOnFile: true,
    hasLegacyStripeSubscription: false,
    hasVerifiedHouseholdMigration: true,
    effectiveCollectionMonth: '2026-11-01',
    billingMonth: '2026-10-01',
  }), 'scheduled_later')
})

test('database Date values preserve a verified household collection month', () => {
  assert.equal(familyAutopayStatus({
    householdMonthlyBillingEnabled: true,
    cardOnFile: true,
    hasLegacyStripeSubscription: false,
    hasVerifiedHouseholdMigration: true,
    effectiveCollectionMonth: new Date('2026-10-01T00:00:00.000Z'),
    billingMonth: '2026-10-01',
  }), 'ready')
})

test('autopay payment-method readiness covers the month and customer that will be collected', () => {
  const summary = (expMonth, expYear) => ({
    available: true,
    customerId: 'cus_1',
    paymentMethod: {
      id: 'pm_1',
      type: 'card',
      customerId: 'cus_1',
      last4: '4242',
      expMonth,
      expYear,
    },
  })
  assert.equal(paymentMethodReadyForBillingMonth(summary(10, 2026), '2026-10-01'), true)
  assert.equal(paymentMethodReadyForBillingMonth(summary(9, 2026), '2026-10-01'), false)
  assert.equal(paymentMethodReadyForBillingMonth(summary(null, null), '2026-10-01'), false)
  assert.equal(paymentMethodReadyForBillingMonth({
    available: true,
    customerId: 'cus_1',
    paymentMethod: { id: 'pm_link', type: 'link', customerId: 'cus_1' },
  }, '2026-10-01'), true)
  assert.equal(paymentMethodReadyForBillingMonth({
    available: true,
    customerId: 'cus_1',
    paymentMethod: { id: 'pm_foreign', type: 'link', customerId: 'cus_other' },
  }, '2026-10-01'), false)
  assert.equal(paymentMethodReadyForBillingMonth({
    available: true,
    customerId: 'cus_1',
    paymentMethod: { id: 'pm_bank', type: 'us_bank_account', customerId: 'cus_1' },
  }, '2026-10-01'), false)
  assert.equal(paymentMethodReadyForBillingMonth({
    available: false,
    customerId: 'cus_1',
    paymentMethod: { id: 'pm_link', type: 'link', customerId: 'cus_1' },
  }, '2026-10-01'), false)
})
