import test from 'node:test'
import assert from 'node:assert/strict'
import { BILLING_DEPLOY_MANIFEST_CHECKSUM } from '../billingReleaseManifest.js'
import { computeBillingDeployManifestChecksum } from '../../scripts/lib/canonical-billing-migration-cli.mjs'
import { activateEnrollmentHouseholdBilling, completeEnrollmentAutoBilling } from '../enrollmentAutoBilling.js'
import { assertAutomaticLedgerCharge } from '../customerBillingPayments.js'

test('automatic enrollment provenance matches the deployed migration manifest', async () => {
  assert.equal(BILLING_DEPLOY_MANIFEST_CHECKSUM, await computeBillingDeployManifestChecksum())
})
test('disabled automatic enrollment has no database or Stripe side effects', async () => {
  const db={query:()=>assert.fail('No database access while disabled')}
  assert.equal((await completeEnrollmentAutoBilling(db,{accountId:1,environment:{}})).status,'feature_disabled')
})
test('missing Stripe customer and existing migration stay visible without inferred activation', async () => {
  const account={id:1,household_monthly_billing_enabled:false,stripe_customer_id:null}
  const db={query:async()=>({rows:[account]})}
  const opts={accountId:1,environment:{BILLING_HOUSEHOLD_AUTO_ACTIVATE_ENABLED:'true'},stripe:{}}
  assert.equal((await activateEnrollmentHouseholdBilling(db,opts)).status,'payment_method_required')
  account.stripe_customer_id='cus_fixture';account.migration_state='shadow_verified'
  assert.equal((await activateEnrollmentHouseholdBilling(db,opts)).status,'migration_review_required')
})
test('automatic exact collection rejects provisional, retired, negative and unknown bills', () => {
  const charge={amount_cents:10000,source_type:'scheduling_signup',source_id:'1'}
  assert.doesNotThrow(()=>assertAutomaticLedgerCharge(charge))
  for(const changes of [{amount_cents:-1},{source_type:'manual'},{source_id:null},
    {metadata:{provisionalBilling:true}},{metadata:{allocationRetired:true}}]) {
    assert.throws(()=>assertAutomaticLedgerCharge({...charge,...changes}),/positive, non-provisional/)
  }
})

test('class moves cannot authorize a second enrollment autopay, including legacy transfer markers', () => {
  const charge = { amount_cents: 12000, source_type: 'scheduling_signup', source_id: '166' }
  for (const metadata of [{ classMoveFromSignupId: 109 }, { classTransfer: { direction: 'in' } }]) {
    assert.throws(() => assertAutomaticLedgerCharge({ ...charge, metadata }), /transfer settlement/)
  }
})

test('scheduled enrollment recovery uses facility collection days and excludes future service', async () => {
  const account = { id: 1, family_id: 2, timezone: 'America/New_York', stripe_customer_id: 'cus_fixture',
    household_monthly_billing_enabled: true, migration_state: 'verified', verified_collection: true }
  const db = { query: async (sql, values) => {
    if (sql.includes('SELECT account.*')) return { rows: [account] }
    assert.match(sql, /COALESCE\(charge.service_period_start, charge.created_at::date\) <= \$4::date/)
    assert.equal(values[3], '2026-11-04')
    return { rows: [] }
  } }
  let methodReads = 0
  const stripe = { customers: { retrieve: async () => {
    methodReads++
    return { id: 'cus_fixture', invoice_settings: { default_payment_method: {
      id: 'pm_fixture', customer: 'cus_fixture', type: 'card', card: { exp_month: 12, exp_year: 2030 },
    } } }
  } } }
  const options = { accountId: 1, environment: { BILLING_HOUSEHOLD_AUTO_ACTIVATE_ENABLED: 'true' }, stripe, scheduledRecovery: true }
  assert.equal((await completeEnrollmentAutoBilling(db, { ...options, now: new Date('2026-11-05T12:00:00Z') })).status,
    'outside_automatic_collection_window')
  assert.equal(methodReads, 0)
  assert.deepEqual(await completeEnrollmentAutoBilling(db, { ...options, now: new Date('2026-11-05T02:00:00Z') }),
    { status: 'complete', paymentCount: 0 })
})
