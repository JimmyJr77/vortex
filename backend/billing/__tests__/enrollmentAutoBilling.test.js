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
