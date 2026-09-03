import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  findDurableRecordedStripePayment,
  loadBillingAccountForFacility,
  requireDurableGenericStripePaymentOwner,
  stripePaymentReceiptIdempotencyKey,
} from '../registerRoutes.js'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))

async function routeSource() {
  return fs.readFile(path.resolve(testDirectory, '../registerRoutes.js'), 'utf8')
}

function routeBlocks(source, route) {
  const marker = `'${route}'`
  const blocks = []
  let cursor = 0
  while (cursor < source.length) {
    const start = source.indexOf(marker, cursor)
    if (start === -1) break
    const next = source.indexOf('\n  app.', start + marker.length)
    blocks.push(source.slice(start, next === -1 ? source.length : next))
    cursor = start + marker.length
  }
  return blocks
}

function routeBlock(source, route) {
  const blocks = routeBlocks(source, route)
  assert.ok(blocks.length > 0, `route ${route} must be registered`)
  return blocks[0]
}

test('legacy billing account lookup is read-only and strictly facility scoped', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params })
      return { rows: [{ id: 71, family_id: 42 }] }
    },
  }

  const account = await loadBillingAccountForFacility(pool, { familyId: 42, facilityId: 9 })

  assert.equal(account.id, 71)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].params, [42, 9])
  assert.match(calls[0].sql, /family\.facility_id = \$2/)
  assert.doesNotMatch(calls[0].sql, /\bINSERT\b/i)
  assert.doesNotMatch(calls[0].sql, /\$2::bigint IS NULL/)
})

test('legacy billing account lookup fails closed without a valid facility', async () => {
  let queryCount = 0
  const pool = {
    async query() {
      queryCount += 1
      return { rows: [] }
    },
  }

  assert.equal(await loadBillingAccountForFacility(pool, { familyId: 42, facilityId: null }), null)
  assert.equal(await loadBillingAccountForFacility(pool, { familyId: 42, facilityId: 'invalid' }), null)
  assert.equal(await loadBillingAccountForFacility(pool, { familyId: null, facilityId: 9 }), null)
  assert.equal(queryCount, 0)
})

test('generic Stripe payment events need durable ownership before any ledger write', () => {
  assert.throws(
    () => requireDurableGenericStripePaymentOwner({
      eventType: 'payment_intent.succeeded',
      reservedAttempt: null,
      paymentIntent: { id: 'pi_unowned' },
    }),
    (error) => (
      error?.code === 'stripe_invoice_payment_binding_conflict'
      && /durable payment-attempt owner/.test(error.message)
    ),
  )
  const attempt = { id: 77 }
  assert.equal(requireDurableGenericStripePaymentOwner({
    eventType: 'payment_intent.succeeded',
    reservedAttempt: attempt,
    paymentIntent: { id: 'pi_owned' },
  }), attempt)
  const payment = { id: 91 }
  assert.equal(requireDurableGenericStripePaymentOwner({
    eventType: 'payment_intent.succeeded',
    recordedPayment: payment,
    paymentIntent: { id: 'pi_recorded' },
  }), payment)
  for (const eventType of [
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
  ]) {
    assert.throws(
      () => requireDurableGenericStripePaymentOwner({
        eventType,
        reservedAttempt: null,
        paymentIntent: {
          id: 'cs_unowned',
          mode: 'payment',
          payment_status: 'paid',
        },
      }),
      (error) => (
        error?.code === 'stripe_checkout_payment_binding_conflict'
        && /durable payment-attempt owner/.test(error.message)
      ),
    )
  }
  assert.equal(requireDurableGenericStripePaymentOwner({
    eventType: 'checkout.session.completed',
    reservedAttempt: attempt,
    paymentIntent: {
      id: 'cs_owned',
      mode: 'payment',
      payment_status: 'paid',
    },
  }), attempt)
  assert.equal(requireDurableGenericStripePaymentOwner({
    eventType: 'checkout.session.completed',
    reservedAttempt: null,
    paymentIntent: {
      id: 'cs_setup',
      mode: 'setup',
      payment_status: 'no_payment_required',
    },
  }), null)
})

test('a recorded PaymentIntent owner must match immutable account, amount, customer, and status', async () => {
  const exact = {
    id: 91,
    family_billing_account_id: 44,
    amount_cents: 7125,
    external_status: 'settled',
    stripe_customer_id: 'cus_family',
    stripe_payment_intent_id: 'pi_recorded',
  }
  const paymentIntent = {
    id: 'pi_recorded',
    amount_received: 7125,
    customer: 'cus_family',
  }
  const matchingPool = {
    async query(sql, params) {
      assert.match(String(sql), /WHERE stripe_payment_intent_id = \$1/)
      assert.deepEqual(params, ['pi_recorded'])
      return { rows: [exact] }
    },
  }
  const replay = await findDurableRecordedStripePayment(matchingPool, {
    paymentIntent,
    accountId: 44,
  })
  assert.equal(replay.id, 91)
  assert.equal(replay.newly_inserted, false)

  for (const mutation of [
    { amount_cents: 7124 },
    { stripe_customer_id: 'cus_other' },
    { family_billing_account_id: 45 },
    { external_status: 'canceled' },
  ]) {
    const pool = { query: async () => ({ rows: [{ ...exact, ...mutation }] }) }
    await assert.rejects(
      findDurableRecordedStripePayment(pool, { paymentIntent, accountId: 44 }),
      /does not have one exact, settled ledger owner/,
    )
  }
})

test('PaymentIntent and invoice webhook paths share one receipt and activity identity', async () => {
  const source = await routeSource()
  assert.equal(
    (source.match(/idempotencyKey: stripePaymentReceiptIdempotencyKey\(/g) ?? []).length,
    2,
  )
  assert.equal((source.match(/eventKey: `stripe-payment-received:\$\{/g) ?? []).length, 2)
  assert.doesNotMatch(source, /eventKey: `stripe-invoice-payment:/)
  assert.equal(stripePaymentReceiptIdempotencyKey({ id: 91 }), 'stripe-payment-receipt:91')
})

test('succeeded PaymentIntent webhooks resolve invoice, Checkout, attempt, and recorded owners in safe order', async () => {
  const source = await routeSource()
  const handler = source.slice(source.indexOf("if (event.type === 'payment_intent.succeeded')"))
  const invoiceResolution = handler.indexOf('resolveStripePaymentIntentInvoice(paymentIntentStripe, obj)')
  const checkoutResolution = handler.indexOf('inspectStripePaymentIntentCheckoutSession(')
  const checkoutDelegation = handler.indexOf("paymentIntentCheckout?.state === 'paid'")
  const attemptResolution = handler.indexOf('findBillingPaymentAttemptForStripeObject(pool, obj)')
  const recordedOwnerResolution = handler.indexOf('findDurableRecordedStripePayment(pool')
  const genericWrite = handler.indexOf('recordStripePayment(pool')

  assert.ok(invoiceResolution >= 0)
  assert.ok(checkoutResolution > invoiceResolution)
  assert.ok(checkoutDelegation > checkoutResolution)
  assert.ok(attemptResolution > checkoutDelegation)
  assert.ok(recordedOwnerResolution > attemptResolution)
  assert.ok(genericWrite > recordedOwnerResolution)
  assert.match(
    handler,
    /paymentIntentCheckout\?\.state === 'paid'[\s\S]*?completeStripeWebhookEvent\(pool, event, webhookClaim\)[\s\S]*?return res\.json\(\{ received: true, checkoutDelegated: true \}\)/,
  )
  assert.match(
    handler,
    /requireDurableGenericStripePaymentOwner\([\s\S]*?recordStripePayment\(pool/,
  )

  const failureHandler = source.slice(source.indexOf("const paymentOwnerPending = err?.code === 'stripe_payment_owner_pending'"))
  assert.match(failureHandler, /if \(!paymentOwnerPending\) \{[\s\S]*?alertType: 'webhook_failure'/)
  assert.match(failureHandler, /paymentOwnerPending[\s\S]*?deferred: true/)
})

test('every legacy admin family billing route uses the authenticated facility lookup', async () => {
  const source = await routeSource()
  const activeRoutes = new Map([
    ['/api/admin/families/:familyId/billing-account', 2],
    ['/api/admin/families/:familyId/charges', 2],
    ['/api/admin/families/:familyId/payments', 2],
    ['/api/admin/families/:familyId/billing-actions', 1],
    ['/api/admin/families/:familyId/payment-link', 1],
    ['/api/admin/families/:familyId/payments/:paymentId/resend-receipt', 1],
    ['/api/admin/families/:familyId/refunds/:refundId/resend-receipt', 1],
    ['/api/admin/families/:familyId/refunds', 1],
  ])

  for (const [route, expectedCount] of activeRoutes) {
    const blocks = routeBlocks(source, route)
    assert.equal(blocks.length, expectedCount, `${route} registration count changed`)
    for (const block of blocks) {
      assert.match(block, /loadBillingAccountForFacility/)
      assert.match(block, /req\.platformAuth\?\.user\?\.facility_id/)
    }
  }
  const statementBlocks = routeBlocks(source, '/api/admin/families/:familyId/statements')
  assert.equal(statementBlocks.length, 2)
  assert.ok(statementBlocks.some((block) => /loadBillingAccountForFacility/.test(block)))
  assert.ok(statementBlocks.some((block) => /rejectLegacyStatementWrite/.test(block)))
  assert.doesNotMatch(source, /ensureBillingAccount/)
  assert.doesNotMatch(source, /INSERT INTO family_billing_account/i)
  assert.match(routeBlock(source, '/api/admin/families/:familyId/charges'), /memberBelongsToFamily/)
})

test('legacy external payment writes delegate to the guarded canonical operation', async () => {
  const source = await routeSource()
  const paymentWrite = routeBlocks(source, '/api/admin/families/:familyId/payments')
    .find((block) => block.includes('recordAdminExternalPayment'))

  assert.ok(paymentWrite, 'legacy external payment route must delegate to the canonical operation')
  assert.match(paymentWrite, /req\.get\('Idempotency-Key'\)/)
  assert.match(paymentWrite, /recordAdminExternalPayment\(pool,/)
  assert.match(paymentWrite, /requestKey: `external-payment:\$\{clientRequestKey\}`/)
  assert.doesNotMatch(paymentWrite, /INSERT INTO billing_payment/)
  assert.doesNotMatch(paymentWrite, /stripeCustomerId|stripePaymentIntentId|externalStatus/)
})

test('legacy Stripe refund creation delegates to the canonical exact-payment operation with a stable idempotency key', async () => {
  const source = await routeSource()
  const refundWrite = routeBlock(source, '/api/admin/families/:familyId/refunds')

  const keyRead = refundWrite.indexOf("req.get('Idempotency-Key')")
  const paymentValidation = refundWrite.indexOf('An exact Stripe paymentId is required')
  const treatmentValidation = refundWrite.indexOf("['reverse_charge', 'return_overpayment'].includes(ledgerTreatment)")
  const accountLookup = refundWrite.indexOf('loadBillingAccountForFacility')
  const refundMutation = refundWrite.indexOf('createCustomerBillingRefund(pool,')
  assert.ok(keyRead >= 0)
  assert.ok(keyRead < paymentValidation)
  assert.ok(paymentValidation < treatmentValidation)
  assert.ok(treatmentValidation < accountLookup)
  assert.ok(accountLookup < refundMutation)
  assert.match(refundWrite, /\^\[A-Za-z0-9_\.:-\]\{8,120\}\$/)
  assert.match(refundWrite, /An exact Stripe paymentId is required/)
  assert.match(refundWrite, /\['reverse_charge', 'return_overpayment'\]\.includes\(ledgerTreatment\)/)
  assert.match(refundWrite, /idempotencyKey: `legacy-refund:\$\{clientRequestKey\}`/)
  assert.doesNotMatch(refundWrite, /createBillingRefund\(pool,|recordBillingActivityBestEffort/)
})

test('legacy account-balance payment links require stable ownership and amount identity', async () => {
  const source = await routeSource()
  const paymentLink = routeBlock(source, '/api/admin/families/:familyId/payment-link')

  assert.match(paymentLink, /req\.get\('Idempotency-Key'\)/)
  assert.match(paymentLink, /idempotencyKey: `legacy-admin-balance-checkout:\$\{clientRequestKey\}`/)
  assert.match(paymentLink, /amountCents: session\.amountCents/)
  assert.match(paymentLink, /idempotencyKey: `admin-payment-request-\$\{session\.id\}`/)
  assert.doesNotMatch(paymentLink, /\bbalanceCents\b/)
})

test('profile payment history and statements resolve active server-side household identity', async () => {
  const source = await routeSource()

  for (const route of ['/api/members/billing/statements', '/api/members/billing/payments']) {
    const block = routeBlock(source, route)
    assert.match(block, /resolveActiveMemberBillingFamilyId/)
    assert.match(block, /loadBillingAccountForFacility/)
    assert.match(block, /ctx\.user\.facility_id/)
    assert.doesNotMatch(block, /ctx\.user\.family_id/)
    assert.doesNotMatch(block, /INSERT INTO family_billing_account/i)
  }
})

test('unsafe direct subscription and pass mutations are permanently retired', async () => {
  const source = await routeSource()
  const subscriptionRoute = routeBlock(source, '/api/admin/subscriptions/:id/status')
  const passRoute = routeBlock(source, '/api/admin/members/:memberId/passes/:passId/adjust')

  assert.match(subscriptionRoute, /rejectDirectSubscriptionStatusWrite/)
  assert.doesNotMatch(subscriptionRoute, /UPDATE billing_subscription/)
  assert.match(source, /BILLING_SUBSCRIPTION_STATUS_WRITE_RETIRED/)
  assert.match(source, /customer-billing\/enrollments\/:signupId\/cancellation/)

  assert.match(passRoute, /rejectLegacyPassAdjustmentWrite/)
  assert.doesNotMatch(passRoute, /UPDATE member_multi_class_pass/)
  assert.match(source, /BILLING_LEGACY_PASS_ADJUSTMENT_RETIRED/)
  assert.match(source, /entitlements\/multi-class-passes\/:passId\/adjustments/)
})
