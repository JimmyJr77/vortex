import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  enrollmentActiveOn,
  listCustomerBillingOverviews,
  familyAutopayStatus,
  familyAutopayScheduled,
  overviewBillingMonths,
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

test('overview shows the previous and current billing months', () => {
  assert.deepEqual(
    overviewBillingMonths(new Date('2026-09-03T16:00:00.000Z')),
    ['2026-08', '2026-09'],
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


test('overview months rotate at the facility month boundary including January', () => {
  assert.deepEqual(overviewBillingMonths(new Date('2027-01-01T04:59:00Z')), ['2026-11', '2026-12'])
  assert.deepEqual(overviewBillingMonths(new Date('2027-01-01T05:00:00Z')), ['2026-12', '2027-01'])
})

test('upcoming month is next calendar month even before the fifth', async () => {
  const pool = { query: async () => ({ rows: [] }) }
  const overview = await listCustomerBillingOverviews(pool, { facilityId: 1, asOf: new Date('2026-10-01T16:00:00Z') })
  assert.deepEqual(overview.months, ['2026-09', '2026-10'])
  assert.equal(overview.upcomingMonth, '2026-11')
})

test('enrolled reflects active service today including free and one-time classes', () => {
  const row = { status: 'confirmed', enrollment_start_date: '2026-10-01', form_end_date: '2026-10-31', pricing_breakdown: { billingType: 'one_time' } }
  assert.equal(enrollmentActiveOn(row, '2026-10-04'), true)
  assert.equal(enrollmentActiveOn(row, '2026-09-30'), false)
  assert.equal(enrollmentActiveOn(row, '2026-11-01'), false)
  assert.equal(enrollmentActiveOn({ ...row, pause_effective_date: '2026-10-04' }, '2026-10-04'), false)
  assert.equal(enrollmentActiveOn({ ...row, cancel_effective_date: '2026-10-04' }, '2026-10-04'), false)
  assert.equal(enrollmentActiveOn({ ...row, status: 'cancelled' }, '2026-10-04'), false)
  assert.equal(enrollmentActiveOn({ ...row, orphaned_at: '2026-10-03' }, '2026-10-04'), false)
})


test('overview reports enrollment and month filters without requiring a billing account or paid tuition', async () => {
  const families = [1, 2, 3, 4].map((id) => ({ family_id: id, billing_account_id: null, facility_timezone: 'America/New_York' }))
  const enrollments = [
    { family_id: 1, status: 'confirmed', enrollment_start_date: '2026-10-01', cancel_effective_date: '2026-11-01' },
    { family_id: 2, status: 'confirmed', enrollment_start_date: '2026-11-01' },
    { family_id: 3, status: 'confirmed', enrollment_start_date: '2026-10-01', pricing_breakdown: { billingType: 'one_time' } },
  ]
  let calls = 0
  const pool = { query: async () => ({ rows: calls++ === 0 ? families : enrollments }) }
  const overview = await listCustomerBillingOverviews(pool, { facilityId: 1, asOf: new Date('2026-10-04T16:00:00Z') })
  assert.deepEqual(overview.families.map(({ enrolled, currentMonthRecurring, upcomingMonthRecurring }) =>
    [enrolled, currentMonthRecurring, upcomingMonthRecurring]), [
    [true, true, false], [false, false, true], [true, false, false], [false, false, false],
  ])
})


test('enrollment query scopes through households without assuming scheduling forms have a facility column', async () => {
  const queries = []
  const pool = { query: async (sql, params) => {
    queries.push({ sql, params })
    return { rows: [] }
  } }
  await listCustomerBillingOverviews(pool, { facilityId: 7 })
  const enrollmentQuery = queries.find(({ sql }) => sql.includes('JOIN scheduling_signup signup'))
  assert.ok(enrollmentQuery)
  assert.match(enrollmentQuery.sql, /WHERE f\.facility_id = \$1/)
  assert.deepEqual(enrollmentQuery.params, [7])
  assert.doesNotMatch(enrollmentQuery.sql, /form\.facility_id/)
})


test('upcoming paid follows payment applications even when an invoice still says paid', async () => {
  for (const invoiceStatus of ['open', 'paid']) {
    const calls = []
    const pool = { query: async (sql, params) => {
      calls.push({ sql, params })
      if (sql.includes('fba.payer_member_id,')) return { rows: [{ family_id: 1, billing_account_id: 10, facility_timezone: 'America/New_York' }] }
      if (sql.includes('SELECT DISTINCT ON (invoice.')) return { rows: [{ family_billing_account_id: 10, billing_month: '2026-11', total_cents: 10000, status: invoiceStatus, amount_paid_cents: 0 }] }
      if (sql.includes('WITH payment_application_totals AS')) return { rows: [{ family_billing_account_id: 10, billing_month: '2026-11', paid_cents: 2500 }] }
      return { rows: [] }
    } }
    const result = await listCustomerBillingOverviews(pool, { facilityId: 1, asOf: new Date('2026-10-04T16:00:00Z') })
    assert.equal(result.families[0].upcomingPaidCents, 2500)
    assert.deepEqual(Object.keys(result.families[0].months), ['2026-09', '2026-10'])
    const payments = calls.find(({ sql }) => sql.includes('WITH payment_application_totals AS'))
    assert.deepEqual(payments.params, [[10], '2026-09-01', '2026-12-01'])
    const ytd = calls.find(({ sql }) => sql.includes('AS year_to_date_paid_cents'))
    assert.deepEqual(ytd.params, [[10], '2026-01-01', '2026-11-01'])
  }
})

test('verified future autopay is enrolled before the collection start month', () => {
  assert.equal(familyAutopayScheduled({
    householdMonthlyBillingEnabled: true, cardOnFile: true,
    hasLegacyStripeSubscription: false, hasVerifiedHouseholdMigration: true,
    effectiveCollectionMonth: '2026-11-01', billingMonth: '2026-10-01',
  }), true)
})

test('month totals use corrected ledger amounts instead of a stale paid invoice', async () => {
  const pool={query:async(sql)=>{
    if(sql.includes('fba.payer_member_id,')) return {rows:[{family_id:1,billing_account_id:10,facility_timezone:'America/New_York'}]}
    if(sql.includes('SELECT DISTINCT ON (invoice.')) return {rows:[{family_billing_account_id:10,billing_month:'2026-10',total_cents:10000,status:'paid'}]}
    if(sql.includes('AS billed_cents')) return {rows:[{family_billing_account_id:10,billing_month:'2026-10',billed_cents:8000}]}
    if(sql.includes('WITH payment_application_totals AS')) return {rows:[{family_billing_account_id:10,billing_month:'2026-10',paid_cents:5000}]}
    return {rows:[]}
  }}
  const result=await listCustomerBillingOverviews(pool,{facilityId:1,asOf:new Date('2026-10-06T16:00:00Z')})
  assert.deepEqual(result.families[0].months['2026-10'],{billedCents:8000,paidCents:5000,source:'ledger'})
})

test('unpaid current tuition moves to outstanding at the facility fifth-day boundary', async () => {
  for (const [asOf, recurringMonth, outstanding] of [
    ['2026-11-05T04:59:00Z', '2026-11', 5000],
    ['2026-11-05T05:00:00Z', '2026-12', 15000],
  ]) {
    const pool = { query: async (sql, params) => {
      if (sql.includes('fba.payer_member_id,')) return { rows: [{ family_id: 1, billing_account_id: 10, facility_timezone: 'America/New_York' }] }
      if (sql.includes('credit_source_application_totals AS')) {
        assert.equal(params[1], recurringMonth)
        return { rows: [
          { id: 1, family_billing_account_id: 10, charge_type: 'recurring', amount_cents: 5000, remaining_amount_cents: 5000, service_period_start: '2026-10-01' },
          { id: 2, family_billing_account_id: 10, charge_type: 'recurring', amount_cents: 10000, remaining_amount_cents: 10000, service_period_start: '2026-11-01' },
        ] }
      }
      return { rows: [] }
    } }
    const result = await listCustomerBillingOverviews(pool, { facilityId: 1, asOf: new Date(asOf) })
    assert.equal(result.families[0].outstandingBalanceCents, outstanding)
  }
})
