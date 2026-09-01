import test from 'node:test'
import assert from 'node:assert/strict'
import {
  billingClassSubscriptionCreationMode,
  billingCanonicalReadMode,
  billingCollectionCutoverEnabled,
  billingEnrollmentAutoRepairEnabled,
  billingHouseholdAutoActivateEnabled,
  billingHouseholdInvoiceEnabled,
  billingStripeSubscriptionCreationAllowed,
  billingStripeSubscriptionCreationMode,
  legacyPerClassStripeCollectionAllowed,
} from '../billingFeatureFlags.js'

test('canonical billing migration controls default fail-closed', () => {
  const environment = {}
  assert.equal(billingCanonicalReadMode(environment), 'off')
  assert.equal(billingCollectionCutoverEnabled(environment), false)
  assert.equal(billingEnrollmentAutoRepairEnabled(environment), false)
  assert.equal(billingHouseholdAutoActivateEnabled(environment), false)
  assert.equal(billingHouseholdInvoiceEnabled(environment), false)
  assert.equal(billingStripeSubscriptionCreationMode(environment), 'disabled')
  assert.equal(billingStripeSubscriptionCreationAllowed(environment), false)
  assert.equal(billingClassSubscriptionCreationMode(environment), 'household_only')
  assert.equal(legacyPerClassStripeCollectionAllowed(environment), false)
})

test('canonical read and cutover permissions cannot enable future Stripe subscriptions', () => {
  assert.equal(billingCanonicalReadMode({ BILLING_CANONICAL_READ_MODE: 'SHADOW' }), 'shadow')
  assert.equal(legacyPerClassStripeCollectionAllowed({ BILLING_CANONICAL_READ_MODE: 'shadow' }), false)
  assert.equal(legacyPerClassStripeCollectionAllowed({ BILLING_CANONICAL_READ_MODE: 'active' }), false)
  assert.equal(legacyPerClassStripeCollectionAllowed({ BILLING_COLLECTION_CUTOVER_ENABLED: 'true' }), false)
  assert.equal(legacyPerClassStripeCollectionAllowed({
    BILLING_CLASS_SUBSCRIPTION_CREATION_MODE: 'legacy',
  }), false)
  assert.throws(
    () => billingCanonicalReadMode({ BILLING_CANONICAL_READ_MODE: 'enabled' }),
    /must be one of off, shadow, active/,
  )
})

test('the explicit household-only phase globally cuts off legacy class subscriptions', () => {
  const environment = {
    BILLING_CLASS_SUBSCRIPTION_CREATION_MODE: 'HOUSEHOLD_ONLY',
  }
  assert.equal(billingClassSubscriptionCreationMode(environment), 'household_only')
  assert.equal(legacyPerClassStripeCollectionAllowed(environment), false)
})

test('an invalid class subscription creation phase fails closed', () => {
  assert.throws(
    () => legacyPerClassStripeCollectionAllowed({
      BILLING_CLASS_SUBSCRIPTION_CREATION_MODE: 'enabled',
    }),
    /must be one of legacy, household_only/,
  )
})

test('future Stripe subscription creation accepts only the disabled mode', () => {
  assert.equal(billingStripeSubscriptionCreationMode({
    BILLING_STRIPE_SUBSCRIPTION_CREATION_MODE: 'DISABLED',
  }), 'disabled')
  assert.throws(
    () => billingStripeSubscriptionCreationAllowed({
      BILLING_STRIPE_SUBSCRIPTION_CREATION_MODE: 'enabled',
    }),
    /must be disabled/,
  )
})
