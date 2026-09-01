import test from 'node:test'
import assert from 'node:assert/strict'

import {
  classifyStripeInvoicePayment,
  recordAuthoritativeStripeInvoicePayment,
} from '../stripeInvoicePayments.js'

function classifierPool(local = null, ownership = null) {
  return {
    async query(sql) {
      const text = String(sql)
      if (text.includes('FROM billing_monthly_invoice')) return { rows: local ? [local] : [] }
      if (text.includes('stripe-subscription:ownership')) return { rows: ownership ? [ownership] : [] }
      throw new Error(`Unexpected classifier query: ${text}`)
    },
  }
}

test('authoritative invoice classifier recognizes an immutable local household invoice', async () => {
  const result = await classifyStripeInvoicePayment(
    classifierPool({ id: 44, family_billing_account_id: 8 }),
    {
      id: 'in_44',
      metadata: { householdMonthlyInvoice: 'true', monthlyInvoiceId: '44', familyBillingAccountId: '8' },
    },
  )
  assert.equal(result.kind, 'household')
})

test('authoritative invoice classifier quarantines orphan, conflicting, and unclassified invoices', async () => {
  const orphan = await classifyStripeInvoicePayment(classifierPool(), {
    id: 'in_orphan',
    metadata: { householdMonthlyInvoice: 'true', monthlyInvoiceId: '99' },
  })
  assert.equal(orphan.kind, 'orphan_household')

  const conflict = await classifyStripeInvoicePayment(
    classifierPool({ id: 44, family_billing_account_id: 8 }),
    {
      id: 'in_conflict',
      subscription: 'sub_44',
      metadata: { householdMonthlyInvoice: 'true', monthlyInvoiceId: '44' },
    },
  )
  assert.equal(conflict.kind, 'conflict')

  const unclassified = await classifyStripeInvoicePayment(classifierPool(), { id: 'in_unknown' })
  assert.equal(unclassified.kind, 'unclassified')
})

test('authoritative invoice classifier admits only an exactly owned legacy subscription renewal', async () => {
  const result = await classifyStripeInvoicePayment(classifierPool(null, {
    billing_subscription_id: 51,
    family_billing_account_id: 8,
    member_id: 7,
    source_type: 'annual_membership',
    pricing_option_key: 'annual_membership',
    local_status: 'active',
    stripe_customer_id: 'cus_family',
    stripe_customer_owner_count: 1,
    household_monthly_billing_enabled: false,
    migration_state: null,
    claimed_account_id: null,
  }), {
    id: 'in_annual',
    customer: 'cus_family',
    parent: { subscription_details: { subscription: 'sub_annual' } },
  })
  assert.equal(result.kind, 'subscription')
  assert.equal(result.subscriptionId, 'sub_annual')
})

test('authoritative invoice recorder returns a specific conflict for a quarantined annual binding', async () => {
  const calls = []
  const pool = {
    async query(sql) {
      const text = String(sql)
      calls.push(text)
      if (text.includes('FROM billing_monthly_invoice')) return { rows: [] }
      if (text.includes('stripe-subscription:ownership')) return { rows: [] }
      if (text.includes('stripe-subscription:customer-owner')) return { rows: [] }
      if (text.includes('FROM billing_subscription')) return { rows: [] }
      throw new Error(`Unexpected quarantine query: ${text}`)
    },
  }
  const result = await recordAuthoritativeStripeInvoicePayment(pool, {
    invoice: {
      id: 'in_orphan_annual',
      paid: true,
      status: 'paid',
      amount_paid: 8500,
      customer: 'cus_family',
      metadata: {
        annualMembership: 'true',
        familyBillingAccountId: '44',
        memberId: '7',
      },
      parent: { subscription_details: { subscription: 'sub_missing_annual' } },
    },
  })
  assert.deepEqual(result, {
    classification: {
      kind: 'conflict',
      code: 'stripe_subscription_owner_missing',
      reason: 'Stripe subscription sub_missing_annual has no exact local owner.',
      localInvoice: null,
      subscriptionId: 'sub_missing_annual',
      subscriptionOwnership: {
        expectedLegacy: false,
        code: 'stripe_subscription_owner_missing',
        reason: 'Stripe subscription sub_missing_annual has no exact local owner.',
        accountId: null,
      },
    },
    payment: null,
    householdSettlement: null,
  })
  assert.equal(calls.some((text) => text.includes('INSERT INTO billing_payment')), false)
})

test('authoritative invoice recorder does not disguise database or programming errors as quarantine', async () => {
  const pool = {
    async query(sql) {
      if (String(sql).includes('FROM billing_monthly_invoice')) return { rows: [] }
      throw new Error('database unavailable')
    },
  }
  await assert.rejects(
    recordAuthoritativeStripeInvoicePayment(pool, {
      invoice: {
        id: 'in_network_error',
        paid: true,
        status: 'paid',
        amount_paid: 8500,
        subscription: 'sub_annual',
      },
    }),
    /database unavailable/,
  )
})

test('subscription invoice for a household-owned account is quarantined before ledger insertion', async () => {
  const calls = []
  const pool = {
    async query(sql) {
      const text = String(sql)
      calls.push(text)
      if (text.includes('FROM billing_monthly_invoice')) return { rows: [] }
      if (text.includes('stripe-subscription:ownership')) {
        return { rows: [{
          billing_subscription_id: 51,
          family_billing_account_id: 8,
          member_id: 7,
          source_type: 'scheduling_signup',
          pricing_option_key: null,
          local_status: 'active',
          stripe_customer_id: 'cus_family',
          stripe_customer_owner_count: 1,
          household_monthly_billing_enabled: true,
          migration_state: 'verified',
          claimed_account_id: 8,
        }] }
      }
      throw new Error(`Unexpected rogue invoice query: ${text}`)
    },
  }
  const result = await recordAuthoritativeStripeInvoicePayment(pool, {
    invoice: {
      id: 'in_rogue_subscription',
      paid: true,
      status: 'paid',
      amount_paid: 12750,
      customer: 'cus_family',
      subscription: 'sub_rogue',
    },
  })

  assert.equal(result.payment, null)
  assert.equal(result.classification.kind, 'conflict')
  assert.equal(result.classification.code, 'stripe_subscription_household_collector_conflict')
  assert.equal(calls.some((text) => text.includes('INSERT INTO billing_payment')), false)
})
