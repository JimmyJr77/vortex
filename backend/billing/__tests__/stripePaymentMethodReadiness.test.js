import test from 'node:test'
import assert from 'node:assert/strict'

import {
  classifyStripePaymentMethodReadiness,
  selectStripeCustomerPaymentMethod,
} from '../stripePaymentMethodReadiness.js'
import { loadDefaultPaymentMethodSummary } from '../customerBillingQueries.js'

function card(overrides = {}) {
  return {
    id: 'pm_card',
    type: 'card',
    customer: 'cus_household',
    card: { brand: 'visa', last4: '4242', exp_month: 10, exp_year: 2026 },
    ...overrides,
  }
}

test('cards must remain valid through the target collection month', () => {
  assert.equal(classifyStripePaymentMethodReadiness(card(), {
    expectedCustomerId: 'cus_household',
    billingMonth: '2026-10-01',
  }).ready, true)
  const expired = classifyStripePaymentMethodReadiness(card(), {
    expectedCustomerId: 'cus_household',
    billingMonth: '2026-11-01',
  })
  assert.equal(expired.ready, false)
  assert.equal(expired.reason, 'payment_method_card_expired_for_billing_month')
})

test('an attached Link PaymentMethod is ready for off-session household invoices', () => {
  const readiness = classifyStripePaymentMethodReadiness({
    id: 'pm_link',
    type: 'link',
    customer: 'cus_household',
    link: { email: null },
  }, {
    expectedCustomerId: 'cus_household',
    billingMonth: '2027-04-01',
  })
  assert.equal(readiness.ready, true)
  assert.equal(readiness.paymentMethodType, 'link')
})

test('foreign, unsupported, unknown, and structurally incomplete methods fail closed', () => {
  const inputs = [
    card({ customer: 'cus_other' }),
    { id: 'pm_bank', type: 'us_bank_account', customer: 'cus_household' },
    { id: 'pm_unknown', customer: 'cus_household' },
    card({ card: { exp_month: null, exp_year: null } }),
  ]
  for (const paymentMethod of inputs) {
    assert.equal(classifyStripePaymentMethodReadiness(paymentMethod, {
      expectedCustomerId: 'cus_household',
      billingMonth: '2026-10-01',
    }).ready, false)
  }
})

test('selection requires the invoice default and never auto-selects an attached method', async () => {
  const stripe = {
    paymentMethods: {
      async list() {
        assert.fail('attached payment methods must not be searched for automatic collection')
      },
    },
  }
  const selection = await selectStripeCustomerPaymentMethod(stripe, {
    id: 'cus_household',
    invoice_settings: { default_payment_method: null },
  }, {
    expectedCustomerId: 'cus_household',
    billingMonth: '2026-10-01',
  })

  assert.equal(selection.readiness.ready, false)
  assert.equal(selection.readiness.reason, 'payment_method_required')
  assert.equal(selection.paymentMethod, null)
  assert.equal(selection.source, null)
})

test('payment-method reads hide a customer shared with an inactive local account', async () => {
  const summary = await loadDefaultPaymentMethodSummary({
    id: 8,
    stripe_customer_id: 'cus_shared',
    stripe_customer_owner_count: 2,
  })

  assert.equal(summary.available, false)
  assert.equal(summary.paymentMethod, null)
  assert.equal(summary.reconciliationRequired, true)
})

test('selection retrieves and validates an explicitly configured Link default', async () => {
  const calls = []
  const stripe = {
    paymentMethods: {
      async retrieve(id) {
        calls.push(id)
        return {
          id,
          type: 'link',
          customer: 'cus_household',
          link: { email: null },
        }
      },
    },
  }
  const selection = await selectStripeCustomerPaymentMethod(stripe, {
    id: 'cus_household',
    invoice_settings: { default_payment_method: 'pm_link' },
  }, {
    expectedCustomerId: 'cus_household',
    billingMonth: '2026-10-01',
  })

  assert.deepEqual(calls, ['pm_link'])
  assert.equal(selection.readiness.ready, true)
  assert.equal(selection.paymentMethod.id, 'pm_link')
  assert.equal(selection.source, 'default')
})
