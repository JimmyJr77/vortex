import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  adjustCustomerBillingCharge,
  cancelRefundedAnnualMembershipSubscriptions,
  checkoutAmountForBillingCharge,
  createOrRecoverBillingCheckoutSession,
  createCustomerBillingCustomCharge,
  linkCustomerBillingPayment,
  previewCustomerBillingRefund,
  validateAnnualMembershipRenewalDiscount,
} from '../customerBillingPayments.js'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))

test('charge adjustment rechecks reservations inside the account lock transaction', async () => {
  const account = { id: 7, family_id: 44, family_name: 'Rivera' }
  const charge = {
    id: 91,
    family_billing_account_id: 7,
    member_id: 8,
    source_type: 'manual',
    amount_cents: 7500,
    gross_amount_cents: 7500,
    description: 'Private lesson',
    service_period_start: '2026-09-01',
    service_period_end: '2026-09-30',
  }
  const order = []
  const client = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock')) {
        order.push('account-lock')
        return { rows: [{ pg_advisory_lock: null }] }
      }
      if (text === 'BEGIN') {
        order.push('begin')
        return { rows: [] }
      }
      if (text.includes('FROM billing_charge') && text.includes('FOR UPDATE')) {
        order.push('charge-lock')
        return { rows: [charge] }
      }
      if (text.includes('FROM billing_monthly_invoice_line')) {
        order.push('reservation-recheck')
        return { rows: [{ reserved: true }] }
      }
      if (text === 'ROLLBACK') {
        order.push('rollback')
        return { rows: [] }
      }
      if (text.includes('pg_advisory_unlock')) {
        order.push('account-unlock')
        return { rows: [{ pg_advisory_unlock: true }] }
      }
      throw new Error(`Unexpected locked adjustment query: ${text}`)
    },
    release() {},
  }
  const pool = {
    async connect() { return client },
    async query(sql) {
      const text = String(sql)
      if (text.includes('FROM family') && text.includes('family_billing_account')) return { rows: [account] }
      if (text.includes('SELECT * FROM billing_charge')) return { rows: [charge] }
      throw new Error(`Unexpected adjustment setup query: ${text}`)
    },
  }

  await assert.rejects(
    adjustCustomerBillingCharge(pool, {
      familyId: 44,
      chargeId: 91,
      finalAmountCents: 5000,
      reason: 'Courtesy credit',
      idempotencyKey: 'adjustment-lock-test',
    }),
    /reserved by an active collection attempt/i,
  )
  assert.deepEqual(order, [
    'account-lock',
    'begin',
    'charge-lock',
    'reservation-recheck',
    'rollback',
    'account-unlock',
  ])
})

test('refund finalization commits local state before allocation and Stripe cancellation', () => {
  const source = fs.readFileSync(path.join(testDirectory, '../customerBillingPayments.js'), 'utf8')
  const finalizeSource = source.slice(
    source.indexOf('export async function finalizeRefundLedgerTreatment'),
    source.indexOf('export async function createCustomerBillingRefund'),
  )
  const lockAt = finalizeSource.indexOf('withBillingAccountCollectionLock')
  const beginAt = finalizeSource.indexOf("db.query('BEGIN')")
  const offsetAt = finalizeSource.indexOf("'refund_offset'")
  const reverseAt = finalizeSource.indexOf('reverseRefundedApplicationsLocked')
  const commitAt = finalizeSource.indexOf("db.query('COMMIT')", reverseAt)
  const allocationAt = finalizeSource.indexOf('allocateHouseholdPaymentsLocked')
  const stripeAt = finalizeSource.indexOf('getStripeClient()')

  assert.ok(lockAt >= 0)
  assert.ok(beginAt >= 0)
  assert.ok(beginAt < offsetAt)
  assert.ok(offsetAt < reverseAt)
  assert.ok(reverseAt < commitAt)
  assert.ok(commitAt < allocationAt)
  assert.ok(allocationAt < stripeAt)
  assert.match(finalizeSource, /collectionLockHeld[\s\S]*finalizeUnderCollectionLock\(pool\)[\s\S]*withBillingAccountCollectionLock/)
  assert.match(finalizeSource, /FROM billing_refund[\s\S]*FOR UPDATE/)
  assert.match(finalizeSource, /REFUND_CHARGE_RESERVED/)
  assert.match(finalizeSource, /REFUND_MEMBERSHIP_STRIPE_CANCELLATION_PENDING/)
})

test('annual refund Stripe cancellation is an idempotent post-commit replay', async () => {
  const canceled = []
  const stripe = {
    subscriptions: {
      async retrieve(id) {
        return { id, status: id === 'sub_already_canceled' ? 'canceled' : 'active' }
      },
      async cancel(id, options) {
        canceled.push({ id, options })
        return { id, status: 'canceled' }
      },
    },
  }

  const result = await cancelRefundedAnnualMembershipSubscriptions(stripe, [
    { stripe_subscription_id: 'sub_already_canceled' },
    { stripe_subscription_id: 'sub_still_active' },
  ])

  assert.deepEqual(canceled, [{ id: 'sub_still_active', options: { prorate: false } }])
  assert.deepEqual(result, [
    { id: 'sub_already_canceled', canceled: true, replayed: true },
    { id: 'sub_still_active', canceled: true, replayed: false },
  ])
})

test('charge Checkout treats paid invoice history as collectible after reversal but blocks live invoice owners', async (t) => {
  const charge = { id: 91, amount_cents: 5000, description: 'Reopened tuition' }
  const checkoutPool = (invoiceStatus) => ({
    async query(sql, params) {
      assert.match(String(sql), /application_kind = 'reversal'/)
      assert.match(String(sql), /payment\.external_status IN \('settled', 'succeeded'\)/)
      assert.equal(params[1].includes('paid'), false)
      return {
        rows: [{
          amount_cents: 5000,
          reserved_on_monthly_invoice: params[1].includes(invoiceStatus),
        }],
      }
    },
  })

  assert.equal(await checkoutAmountForBillingCharge(checkoutPool('paid'), {
    account: { id: 7 },
    charge,
    requireManualCharge: false,
  }), 5000)

  for (const status of ['open', 'failed']) {
    await t.test(status, async () => {
      await assert.rejects(
        checkoutAmountForBillingCharge(checkoutPool(status), {
          account: { id: 7 },
          charge,
          requireManualCharge: false,
        }),
        /already included in a household monthly invoice/i,
      )
    })
  }
})

test('annual-fee and custom-charge collectors ignore unsettled payment applications', () => {
  const source = fs.readFileSync(path.join(testDirectory, '../customerBillingPayments.js'), 'utf8')
  const annualFeeSource = source.slice(
    source.indexOf('export async function billAnnualMembershipNow'),
    source.indexOf('async function loadCharge'),
  )
  const checkoutSource = source.slice(
    source.indexOf('export async function checkoutAmountForBillingCharge'),
    source.indexOf('async function createBillingChargeCheckoutSession'),
  )
  const customChargeSource = source.slice(
    source.indexOf('export async function collectCustomChargeWithSavedCard'),
    source.indexOf('export async function linkCustomerBillingPayment'),
  )

  for (const scopedSource of [annualFeeSource, checkoutSource]) {
    assert.match(scopedSource, /JOIN billing_payment payment ON payment\.id = \w+\.billing_payment_id/)
    assert.match(scopedSource, /payment\.external_status IN \('settled', 'succeeded'\)/)
  }
  assert.equal(
    [...customChargeSource.matchAll(/payment\.external_status IN \('settled', 'succeeded'\)/g)].length,
    2,
  )
})

test('Checkout creation replay reuses the persisted request and attaches Stripe original after a crash', async () => {
  let persistedRequest = null
  const db = {
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes("metadata->'stripeCreateRequest'")) {
        persistedRequest ??= JSON.parse(params[1])
        return { rows: [{ stripe_create_request: persistedRequest }] }
      }
      if (text.includes("status = CASE WHEN status = 'reserved'")) return { rows: [{ id: 81 }] }
      throw new Error(`Unexpected Checkout replay query: ${text}`)
    },
  }
  const createCalls = []
  let original = null
  const stripe = {
    checkout: {
      sessions: {
        async create(params, options) {
          const request = JSON.parse(JSON.stringify(params))
          createCalls.push({ params: request, options: { ...options } })
          if (!original) {
            original = {
              id: 'cs_original_81',
              url: 'https://checkout.test/original-81',
              expires_at: params.expires_at,
              request,
              key: options.idempotencyKey,
            }
          } else if (
            options.idempotencyKey !== original.key
            || JSON.stringify(request) !== JSON.stringify(original.request)
          ) {
            throw new Error('Stripe idempotency parameters changed')
          }
          return original
        },
      },
    },
  }
  const attempt = {
    id: 81,
    status: 'processing',
    expires_at: '2026-09-01T12:34:56.000Z',
  }
  const firstParams = {
    mode: 'payment',
    expires_at: 1_788_266_096,
    success_url: 'https://app.test/first-success',
    cancel_url: 'https://app.test/first-cancel',
    metadata: { billingPaymentAttemptId: '81', gaClientId: 'first-analytics' },
  }
  let attachCalls = 0
  const attached = []
  const attachAttempt = async (_db, input) => {
    attachCalls += 1
    if (attachCalls === 1) throw new Error('simulated crash before local attachment')
    attached.push(input)
  }

  await assert.rejects(
    createOrRecoverBillingCheckoutSession(db, stripe, {
      attempt,
      requestParams: firstParams,
      attachAttempt,
    }),
    /simulated crash/,
  )
  const replay = await createOrRecoverBillingCheckoutSession(db, stripe, {
    attempt,
    requestParams: {
      ...firstParams,
      expires_at: firstParams.expires_at + 3600,
      success_url: 'https://app.test/changed-success',
      metadata: { billingPaymentAttemptId: '81', gaClientId: 'changed-analytics' },
    },
    attachAttempt,
  })

  assert.equal(createCalls.length, 2)
  assert.deepEqual(createCalls[1], createCalls[0])
  assert.equal(replay.session.id, 'cs_original_81')
  assert.equal(attached.length, 1)
  assert.equal(attached[0].checkoutSessionId, 'cs_original_81')
  assert.equal(attached[0].checkoutUrl, 'https://checkout.test/original-81')
  assert.equal(attached[0].expiresAt, '2026-09-01T12:34:56.000Z')
})

function refundPreviewPool({ balanceCents = 2500, refundedCents = 2000, chargeAmountCents = 7000 } = {}) {
  return {
    async query(sql) {
      if (sql.includes('FROM billing_payment WHERE id')) {
        return { rows: [{ id: 9, amount_cents: 10000, stripe_payment_intent_id: 'pi_123' }] }
      }
      if (sql.includes('FROM billing_refund WHERE payment_id')) {
        return { rows: [{ cents: refundedCents }] }
      }
      if (sql.includes('AS balance_cents')) {
        return { rows: [{ balance_cents: balanceCents }] }
      }
      if (sql.includes('FROM billing_charge WHERE id')) {
        return { rows: [{ id: 4, amount_cents: chargeAmountCents, description: 'Monthly tuition' }] }
      }
      if (sql.includes("ledger_treatment = 'reverse_charge'")) {
        return { rows: [{ cents: 1000 }] }
      }
      if (sql.includes('FROM billing_payment_application')) {
        return { rows: [{ cents: chargeAmountCents }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
}

test('refund preview preserves account balance when a related charge is reversed', async () => {
  const preview = await previewCustomerBillingRefund(refundPreviewPool(), {
    account: { id: 1 },
    paymentId: 9,
    amountCents: 3000,
    ledgerTreatment: 'reverse_charge',
    relatedChargeId: 4,
  })
  assert.equal(preview.remainingRefundableCents, 8000)
  assert.equal(preview.currentBalanceCents, 2500)
  assert.equal(preview.resultingBalanceCents, 2500)
  assert.equal(preview.relatedCharge.id, 4)
})

test('overpayment refund cannot exceed the household credit balance', async () => {
  await assert.rejects(
    previewCustomerBillingRefund(refundPreviewPool({ balanceCents: -1500 }), {
      account: { id: 1 },
      paymentId: 9,
      amountCents: 2000,
      ledgerTreatment: 'return_overpayment',
    }),
    /unapplied overpayment/i,
  )
})

test('custom charge request keys reuse one immutable ledger charge', async () => {
  let storedCharge = null
  let activityWrites = 0
  const pool = {
    async query(sql, values) {
      if (sql.includes('JOIN family_billing_account account')) {
        return { rows: [{ id: 7, family_id: 44, family_name: 'Rivera' }] }
      }
      if (sql.includes('SELECT m.id FROM member')) return { rows: [{ id: 8 }] }
      if (sql.includes('INSERT INTO billing_charge')) {
        if (storedCharge) return { rows: [] }
        storedCharge = {
          id: 99,
          family_billing_account_id: 7,
          member_id: 8,
          source_type: 'manual',
          source_id: values[2],
          description: values[3],
          amount_cents: values[4],
          service_period_start: values[5],
          service_period_end: values[6],
        }
        return { rows: [storedCharge] }
      }
      if (sql.includes("WHERE family_billing_account_id = $1 AND source_type = 'manual'")) {
        return { rows: [storedCharge] }
      }
      if (sql.includes('INSERT INTO billing_account_activity')) {
        activityWrites += 1
        return { rows: [{ id: activityWrites }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  const input = {
    familyId: 44,
    actorUserId: 3,
    memberId: 8,
    description: 'Private lesson',
    amountCents: 7500,
    collectionMethod: 'checkout',
    idempotencyKey: 'custom-charge:test-request-123',
  }
  const first = await createCustomerBillingCustomCharge(pool, input)
  const replay = await createCustomerBillingCustomCharge(pool, input)
  assert.equal(first.created, true)
  assert.equal(replay.created, false)
  assert.equal(replay.charge.id, first.charge.id)
  assert.equal(activityWrites, 1)
})

test('custom charges reject impossible service-period calendar dates', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('JOIN family_billing_account account')) {
        return { rows: [{ id: 7, family_id: 44, family_name: 'Rivera' }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  await assert.rejects(
    createCustomerBillingCustomCharge(pool, {
      familyId: 44,
      actorUserId: 3,
      description: 'Private lesson',
      amountCents: 7500,
      servicePeriodStart: '2026-02-30',
      collectionMethod: 'ledger_only',
    }),
    /valid calendar date/i,
  )
})

test('payment application rejects anything other than the exact account charge amount', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('FROM billing_charge WHERE id')) {
        return { rows: [{ id: 4, family_billing_account_id: 1, amount_cents: 7000 }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  await assert.rejects(
    linkCustomerBillingPayment(pool, {
      payment: { id: 9, family_billing_account_id: 1, amount_cents: 6500 },
      chargeId: 4,
      accountId: 1,
    }),
    /exactly match/i,
  )
})

test('an expired annual membership renewal promo is removed and standard Stripe pricing is restored', async () => {
  const calls = []
  const pricing = {
    id: 71,
    family_billing_account_id: 12,
    family_id: 22,
    member_id: 32,
    additional_fee_id: 42,
    facility_id: 4,
    standard_amount_cents: 8500,
    billing_subscription_id: 52,
    stripe_subscription_id: 'sub_annual',
    pricing_kind: 'promo_code',
    promo_code: 'EXPIRED',
    discount_rule_id: 62,
  }
  const pool = {
    async query(sql, params) {
      const text = String(sql)
      calls.push({ sql: text, params })
      if (text.includes('SELECT pricing.*, account.family_id')) return { rows: [pricing] }
      if (text.includes('FROM family_billing_account account')) {
        return {
          rows: [{
            id: 12,
            household_monthly_billing_enabled: false,
            migration_state: 'rolled_back',
          }],
        }
      }
      if (text.includes('SELECT * FROM discount_rule')) {
        return {
          rows: [{
            id: 62,
            active: true,
            type: 'promo_code',
            amount_type: 'percent',
            amount_value: 5000,
            starts_at: '2020-01-01',
            ends_at: '2025-01-01',
            config: { code: 'EXPIRED', benefit_type: 'annual_membership' },
          }],
        }
      }
      if (text.includes('FROM discount_rule_tier')) return { rows: [] }
      if (text.includes('UPDATE annual_membership_renewal_pricing')) {
        return { rows: [{ ...pricing, pricing_kind: 'manual_final_price', promo_code: null, final_amount_cents: 8500 }] }
      }
      if (text.includes('INSERT INTO billing_account_activity')) return { rows: [{ id: 1 }] }
      return { rows: [] }
    },
  }
  const updates = []
  const stripe = {
    subscriptions: {
      retrieve: async () => ({
        id: 'sub_annual',
        metadata: { annualRenewalPromoCode: 'EXPIRED' },
        items: { data: [{ id: 'si_annual', price: { product: 'prod_annual' } }] },
      }),
      update: async (id, payload) => { updates.push({ id, payload }); return { id } },
    },
    prices: {
      create: async (payload) => {
        assert.equal(payload.unit_amount, 8500)
        assert.equal(payload.metadata.annual_renewal_pricing, 'standard_price')
        return { id: 'price_standard' }
      },
    },
  }

  const result = await validateAnnualMembershipRenewalDiscount(pool, {
    stripeSubscriptionId: 'sub_annual',
    stripe,
    now: new Date('2026-08-30T00:00:00Z'),
  })

  assert.equal(result.status, 'invalidated')
  assert.equal(result.previousPromoCode, 'EXPIRED')
  assert.equal(updates.length, 1)
  assert.deepEqual(updates[0].payload.items, [{ id: 'si_annual', price: 'price_standard' }])
  assert.equal(updates[0].payload.proration_behavior, 'none')
  assert.equal(updates[0].payload.metadata.annualRenewalPromoCode, '')
  assert.ok(calls.some((call) => call.sql.includes('UPDATE billing_subscription')))
})

test('household-owned annual renewal pricing is restored locally without touching the stale collector', async () => {
  let remoteReads = 0
  const pricing = {
    id: 71,
    family_billing_account_id: 12,
    family_id: 22,
    member_id: 32,
    additional_fee_id: 42,
    facility_id: 4,
    standard_amount_cents: 8500,
    billing_subscription_id: 52,
    stripe_subscription_id: 'sub_stale',
    pricing_kind: 'promo_code',
    promo_code: 'EXPIRED',
    discount_rule_id: 62,
  }
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('SELECT pricing.*, account.family_id')) return { rows: [pricing] }
      if (text.includes('SELECT * FROM discount_rule')) {
        return {
          rows: [{
            id: 62,
            active: true,
            type: 'promo_code',
            amount_type: 'percent',
            amount_value: 5000,
            starts_at: '2020-01-01',
            ends_at: '2025-01-01',
            config: { code: 'EXPIRED', benefit_type: 'annual_membership' },
          }],
        }
      }
      if (text.includes('FROM discount_rule_tier')) return { rows: [] }
      if (text.includes('FROM family_billing_account account')) {
        return {
          rows: [{
            id: 12,
            household_monthly_billing_enabled: true,
            migration_state: 'verified',
          }],
        }
      }
      if (text.includes('INSERT INTO stripe_billing_alert')) return { rows: [{ id: 81 }] }
      if (text.includes('UPDATE annual_membership_renewal_pricing')) {
        return {
          rows: [{
            ...pricing,
            pricing_kind: 'manual_final_price',
            promo_code: null,
            final_amount_cents: 8500,
            sync_status: 'not_required',
          }],
        }
      }
      if (text.includes('INSERT INTO billing_account_activity')) return { rows: [{ id: 1 }] }
      return { rows: [] }
    },
  }

  const result = await validateAnnualMembershipRenewalDiscount(pool, {
    stripeSubscriptionId: 'sub_stale',
    stripe: {
      subscriptions: {
        retrieve: async () => {
          remoteReads += 1
          throw new Error('stale remote collector must not be read')
        },
      },
    },
    now: new Date('2026-08-30T00:00:00Z'),
  })

  assert.equal(result.status, 'local_authoritative')
  assert.equal(result.remoteCollectorQuarantined, true)
  assert.equal(remoteReads, 0)
})
