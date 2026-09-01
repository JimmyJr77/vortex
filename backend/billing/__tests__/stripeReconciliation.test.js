import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  paymentAmountsMismatch,
  reconcileCanonicalStripeCollectorInventory,
  reconcileStripeSubscriptionPrices,
  subscriptionScheduleHasDrift,
} from '../stripeReconciliation.js'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))

test('reconciliation treats numeric database strings and Stripe integers as equal',()=>{
  assert.equal(paymentAmountsMismatch('2500',2500),false)
  assert.equal(paymentAmountsMismatch(2499,2500),true)
})

test('reconciliation detects Stripe phase amount, boundary, and count drift', () => {
  const expected = [
    { periodKey: '2026-08', amountCents: 10000, endPeriodKey: '2026-10' },
    { periodKey: '2026-10', amountCents: 8000, endPeriodKey: null },
  ]
  assert.equal(subscriptionScheduleHasDrift(expected, expected), false)
  assert.equal(subscriptionScheduleHasDrift(expected, [
    expected[0],
    { ...expected[1], amountCents: 8100 },
  ]), true)
  assert.equal(subscriptionScheduleHasDrift(expected, [expected[0]]), true)
  assert.equal(subscriptionScheduleHasDrift(expected, [
    { ...expected[0], endPeriodKey: '2026-11' },
    expected[1],
  ]), true)
})

test('subscription reconciliation excludes household and cutover-owned accounts in SQL', async () => {
  let selector = ''
  const pool = {
    async query(sql) {
      selector = String(sql)
      return { rows: [] }
    },
  }

  const result = await reconcileStripeSubscriptionPrices(pool, {})

  assert.equal(result.subscriptionsChecked, 0)
  assert.match(selector, /fba\.household_monthly_billing_enabled = FALSE/)
  assert.match(selector, /NOT EXISTS\s*\([\s\S]*FROM billing_account_migration/)
  for (const state of [
    'armed',
    'cancellation_scheduled',
    'detached',
    'remote_retired',
    'household_active',
    'verified',
    'failed_forward_only',
    'rollback_pending',
  ]) {
    assert.match(selector, new RegExp(`'${state}'`))
  }
})

test('succeeded-payment reconciliation routes durable owners before general allocation', () => {
  const source = fs.readFileSync(path.join(testDirectory, '../stripeReconciliation.js'), 'utf8')
  const attemptMapping = source.indexOf('recordAndCompleteBillingPaymentAttempt(pool')
  const invoiceMapping = source.indexOf('recordAuthoritativeStripeInvoicePayment(pool')
  const genericInsert = source.indexOf('const inserted = await recordStripePayment(pool')
  assert.ok(attemptMapping >= 0 && attemptMapping < genericInsert)
  assert.ok(invoiceMapping >= 0 && invoiceMapping < genericInsert)
  assert.match(source, /if \(reservedAttempt\)[\s\S]*?continue/)
  assert.match(source, /if \(stripeInvoiceId\)[\s\S]*?recordAuthoritativeStripeInvoicePayment\(pool[\s\S]*?continue/)
  assert.match(source, /classification\.kind !== 'subscription'[\s\S]*?continue/)
})

test('webhook and reconciliation use the same fail-closed invoice classifier', () => {
  const reconciliationSource = fs.readFileSync(path.join(testDirectory, '../stripeReconciliation.js'), 'utf8')
  const routeSource = fs.readFileSync(path.join(testDirectory, '../../platform/registerRoutes.js'), 'utf8')
  assert.match(reconciliationSource, /recordAuthoritativeStripeInvoicePayment\(pool/)
  assert.match(routeSource, /event\.type === 'payment_intent\.succeeded' && obj\.invoice/)
  assert.equal((routeSource.match(/recordAuthoritativeStripeInvoicePayment\(pool/g) ?? []).length, 2)
  assert.match(routeSource, /classification\.kind !== 'subscription'/)
})

test('canonical customer inventory flags every live subscription and schedule, including annual labels', async () => {
  const calls = []
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('canonical-collector:account-inventory')) {
        return { rows: [{ id: 44, stripe_customer_id: 'cus_44', migration_state: 'verified' }] }
      }
      if (text.includes('FROM billing_subscription') && text.includes('family_billing_account_id')) {
        return { rows: [{
          id: 91,
          source_type: 'annual_membership',
          pricing_option_key: 'annual_membership',
          status: 'active',
          stripe_subscription_id: 'sub_annual_rogue',
        }] }
      }
      if (text.includes('INSERT INTO stripe_billing_alert')) return { rows: [{ id: 1 }] }
      // recordStripeBillingAlert's optional payment-owner resolution is not
      // authoritative for this account-scoped inventory alert.
      if (text.includes('FROM billing_payment')) return { rows: [] }
      throw new Error(`Unexpected canonical inventory query: ${text}`)
    },
  }
  const stripe = {
    subscriptions: {
      async list() {
        return {
          data: [{
            id: 'sub_annual_rogue',
            status: 'active',
            customer: 'cus_44',
            metadata: {
              annualMembership: 'true',
              billingSubscriptionId: '91',
              familyBillingAccountId: '44',
            },
            items: { data: [] },
          }],
          has_more: false,
        }
      },
    },
    subscriptionSchedules: {
      async list() {
        return {
          data: [{
            id: 'sub_sched_rogue',
            status: 'active',
            customer: 'cus_44',
            subscription: 'sub_annual_rogue',
          }],
          has_more: false,
        }
      },
    },
  }

  const result = await reconcileCanonicalStripeCollectorInventory(pool, stripe)

  assert.equal(result.accountsChecked, 1)
  assert.equal(result.collectorDriftsFound, 2)
  const alert = calls.find(({ text }) => text.includes('INSERT INTO stripe_billing_alert'))
  assert.ok(alert)
  assert.equal(alert.params[1], 44)
  assert.equal(alert.params[2], 'canonical_remote_collector_drift')
})
