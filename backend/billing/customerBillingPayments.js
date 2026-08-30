import { randomUUID } from 'crypto'
import {
  createCustomerPortalSession,
  ensureStripeCustomer,
  getStripeClient,
  recordStripePayment,
  stripeEnabled,
} from './stripeBilling.js'
import { createBillingRefund } from './stripeOperations.js'
import { recordBillingActivity } from './billingActivity.js'
import { ensureCustomerBillingAccount } from './customerBillingQueries.js'
import {
  applyExactPayment,
  allocateHouseholdPayments,
  endRefundedAnnualMembership,
  reverseRefundedApplications,
} from './paymentAllocation.js'

function positiveCents(value, label = 'Amount') {
  const amount = Number(value)
  if (!Number.isInteger(amount) || amount <= 0) throw new Error(`${label} must be a positive whole-cent amount.`)
  return amount
}

function optionalDate(value, label) {
  if (value == null || value === '') return null
  const date = String(value).slice(0, 10)
  const parsed = new Date(`${date}T00:00:00Z`)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`${label} must be a valid calendar date.`)
  }
  return date
}

async function validateMemberScope(pool, account, memberId) {
  if (memberId == null) return null
  const result = await pool.query(
    `SELECT m.id FROM member m
     WHERE m.id = $1 AND (
       m.family_id = $2 OR EXISTS (
         SELECT 1 FROM family_member fm
         WHERE fm.member_id = m.id AND fm.family_id = $2 AND fm.is_active = TRUE
       )
     )`,
    [Number(memberId), Number(account.family_id)],
  )
  if (!result.rows[0]) throw new Error('Selected member does not belong to this household.')
  return Number(memberId)
}

async function loadCharge(pool, accountId, chargeId) {
  const result = await pool.query(
    `SELECT * FROM billing_charge WHERE id = $1 AND family_billing_account_id = $2`,
    [Number(chargeId), Number(accountId)],
  )
  if (!result.rows[0]) throw new Error('Custom charge was not found.')
  return result.rows[0]
}

function assertCustomCharge(charge) {
  if (charge.source_type !== 'manual' || Number(charge.amount_cents) <= 0) {
    throw new Error('Only a positive custom ledger charge can use exact-amount collection.')
  }
}

function assertCollectibleCustomCharge(charge) {
  assertCustomCharge(charge)
  if (charge.collection_status === 'paid') {
    throw new Error('This custom charge has already been paid.')
  }
}

export async function createCustomerBillingCustomCharge(pool, {
  familyId,
  facilityId = null,
  actorUserId,
  memberId = null,
  description,
  amountCents,
  servicePeriodStart = null,
  servicePeriodEnd = null,
  collectionMethod = 'checkout',
  idempotencyKey = null,
}) {
  const account = await ensureCustomerBillingAccount(pool, familyId, facilityId)
  if (!account) throw new Error('Family billing account was not found.')
  const scopedMemberId = await validateMemberScope(pool, account, memberId)
  const amount = positiveCents(amountCents)
  const label = String(description ?? '').trim()
  if (!label) throw new Error('A custom charge description is required.')
  if (!['checkout', 'saved_card', 'ledger_only'].includes(collectionMethod)) {
    throw new Error('Collection method must be checkout, saved_card, or ledger_only.')
  }
  const periodStart = optionalDate(servicePeriodStart, 'Service period start')
  const periodEnd = optionalDate(servicePeriodEnd, 'Service period end')
  if (periodStart && periodEnd && periodEnd < periodStart) {
    throw new Error('Service period end cannot be before its start.')
  }
  const requestKey = String(idempotencyKey ?? '').trim()
  const sourceId = `custom:${requestKey || randomUUID()}`
  const result = await pool.query(
    `INSERT INTO billing_charge (
       family_billing_account_id, member_id, source_type, source_id,
       description, amount_cents, gross_amount_cents, discount_amount_cents,
       charge_type, billing_interval, service_period_start, service_period_end,
       collection_status, created_by_user_id, metadata
     ) VALUES (
       $1, $2, 'manual', $3, $4, $5, $5, 0, 'one_time', 'one_time',
       $6, $7, 'unpaid', $8, $9::jsonb
     )
     ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
     RETURNING *`,
    [
      account.id,
      scopedMemberId,
      sourceId,
      label,
      amount,
      periodStart,
      periodEnd,
      actorUserId,
      JSON.stringify({ collectionMethod }),
    ],
  )
  let charge = result.rows[0]
  const created = Boolean(charge)
  if (!charge) {
    charge = await pool.query(
      `SELECT * FROM billing_charge
       WHERE family_billing_account_id = $1 AND source_type = 'manual' AND source_id = $2`,
      [account.id, sourceId],
    ).then((lookup) => lookup.rows[0] ?? null)
    if (!charge) throw new Error('The custom-charge request key is already in use by another account.')
    const sameRequest =
      Number(charge.member_id ?? 0) === Number(scopedMemberId ?? 0) &&
      Number(charge.amount_cents) === amount &&
      String(charge.description) === label &&
      String(charge.service_period_start ?? '').slice(0, 10) === String(periodStart ?? '').slice(0, 10) &&
      String(charge.service_period_end ?? '').slice(0, 10) === String(periodEnd ?? '').slice(0, 10)
    if (!sameRequest) throw new Error('The custom-charge request key was reused with different charge details.')
  }
  if (created) {
    await recordBillingActivity(pool, {
      eventKey: `custom-charge-created:${charge.id}`,
      accountId: account.id,
      memberId: scopedMemberId,
      chargeId: charge.id,
      eventType: 'custom_charge_created',
      summary: `Custom charge created: ${label}.`,
      afterValue: {
        chargeId: Number(charge.id),
        amountCents: amount,
        servicePeriodStart: periodStart,
        servicePeriodEnd: periodEnd,
        collectionMethod,
      },
      actorUserId,
    })
    if (collectionMethod === 'ledger_only') {
      await allocateHouseholdPayments(pool, { accountId: account.id, actorType: 'admin' })
    }
  }
  return { account, charge, created }
}

export async function createCustomChargeCheckoutSession(pool, {
  account,
  charge,
  successUrl,
  cancelUrl,
  actorUserId = null,
  attemptKey = null,
}) {
  assertCollectibleCustomCharge(charge)
  if (!stripeEnabled()) throw new Error('Stripe is not enabled.')
  const stripe = await getStripeClient()
  if (!stripe) throw new Error('Stripe is unavailable.')
  const customerId = await ensureStripeCustomer(pool, stripe, account)
  const metadata = {
    checkoutType: 'custom_charge',
    familyBillingAccountId: String(account.id),
    billingChargeId: String(charge.id),
  }
  const attempts = await pool.query(
    `SELECT COUNT(*)::int AS count FROM billing_account_activity
     WHERE related_charge_id = $1 AND event_type = 'custom_charge_checkout_created'`,
    [charge.id],
  )
  const attempt = Number(attempts.rows[0]?.count ?? 0) + 1
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      customer: customerId,
      client_reference_id: `billing-charge:${charge.id}`,
      expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Number(charge.amount_cents),
          product_data: { name: String(charge.description).slice(0, 127) },
        },
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      payment_intent_data: { metadata },
    },
    { idempotencyKey: `custom-charge-checkout-${charge.id}-${attemptKey || `attempt-${attempt}`}` },
  )
  await pool.query(
    `UPDATE billing_charge
     SET collection_status = 'checkout_pending', stripe_checkout_session_id = $2
     WHERE id = $1`,
    [charge.id, session.id],
  )
  await recordBillingActivity(pool, {
    eventKey: `custom-charge-checkout:${charge.id}:${session.id}`,
    accountId: account.id,
    memberId: charge.member_id,
    chargeId: charge.id,
    eventType: 'custom_charge_checkout_created',
    summary: `Secure payment link created for ${charge.description}.`,
    details: {
      amountCents: Number(charge.amount_cents),
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    },
    stripeObjectId: session.id,
    actorUserId,
  })
  return {
    id: session.id,
    url: session.url,
    amountCents: Number(charge.amount_cents),
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
  }
}

async function resolveDefaultPaymentMethod(stripe, customerId) {
  const customer = await stripe.customers.retrieve(customerId, {
    expand: ['invoice_settings.default_payment_method'],
  })
  if (!customer || customer.deleted) throw new Error('Stripe customer is unavailable.')
  let paymentMethod = customer.invoice_settings?.default_payment_method ?? null
  if (typeof paymentMethod === 'object') paymentMethod = paymentMethod.id
  if (!paymentMethod) {
    const methods = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 })
    paymentMethod = methods.data?.[0]?.id ?? null
  }
  if (!paymentMethod) throw new Error('No reusable saved card is available for this household.')
  return paymentMethod
}

function validateAuthorization(authorization, amountCents) {
  const source = String(authorization?.source ?? '').trim()
  const note = String(authorization?.note ?? '').trim()
  const date = String(authorization?.date ?? '').slice(0, 10)
  if (!source || !note || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Authorization source, date, and note are required for a saved-card charge.')
  }
  if (authorization?.confirmedAmountCents !== amountCents || authorization?.confirmed !== true) {
    throw new Error('The exact saved-card charge amount must be confirmed for this attempt.')
  }
  return { source, note, date }
}

export class SavedCardCollectionError extends Error {
  constructor(message, { fallback = null, stripeStatus = null } = {}) {
    super(message)
    this.name = 'SavedCardCollectionError'
    this.fallback = fallback
    this.stripeStatus = stripeStatus
  }
}

export async function collectCustomChargeWithSavedCard(pool, {
  account,
  charge,
  authorization,
  successUrl,
  cancelUrl,
  actorUserId,
  attemptKey = null,
}) {
  assertCustomCharge(charge)
  if (charge.collection_status === 'paid') {
    const payment = await pool.query(
      `SELECT payment.*
       FROM billing_payment_application application
       JOIN billing_payment payment ON payment.id = application.billing_payment_id
       WHERE application.billing_charge_id = $1`,
      [charge.id],
    ).then((result) => result.rows[0] ?? null)
    if (!payment) throw new Error('This charge is marked paid but its payment application needs reconciliation.')
    return { intent: null, payment, replayed: true }
  }
  assertCollectibleCustomCharge(charge)
  if (!stripeEnabled()) throw new Error('Stripe is not enabled.')
  const auth = validateAuthorization(authorization, Number(charge.amount_cents))
  const stripe = await getStripeClient()
  if (!stripe) throw new Error('Stripe is unavailable.')
  const customerId = await ensureStripeCustomer(pool, stripe, account)
  const paymentMethodId = await resolveDefaultPaymentMethod(stripe, customerId)
  const attempts = await pool.query(
    `SELECT COUNT(*)::int AS count FROM billing_account_activity
     WHERE related_charge_id = $1 AND event_type = 'saved_card_payment_attempted'`,
    [charge.id],
  )
  const attempt = Number(attempts.rows[0]?.count ?? 0) + 1
  await pool.query(
    `UPDATE billing_charge
     SET collection_status = 'processing', authorization_source = $2,
         authorization_date = $3, authorization_note = $4
     WHERE id = $1`,
    [charge.id, auth.source, auth.date, auth.note],
  )
  await recordBillingActivity(pool, {
    eventKey: `saved-card-attempt:${charge.id}:${attempt}`,
    accountId: account.id,
    memberId: charge.member_id,
    chargeId: charge.id,
    eventType: 'saved_card_payment_attempted',
    summary: `Saved card charge attempted for ${charge.description}.`,
    details: { amountCents: Number(charge.amount_cents), authorization: auth, attempt },
    actorUserId,
  })

  let succeededIntent = null
  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: Number(charge.amount_cents),
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: String(charge.description).slice(0, 500),
        metadata: {
          checkoutType: 'custom_charge',
          familyBillingAccountId: String(account.id),
          billingChargeId: String(charge.id),
          authorizationDate: auth.date,
          authorizationSource: auth.source.slice(0, 100),
        },
      },
      { idempotencyKey: `custom-charge-${charge.id}-${attemptKey || `attempt-${attempt}`}` },
    )
    if (intent.status !== 'succeeded') {
      throw Object.assign(new Error(`Stripe payment requires additional action (${intent.status}).`), {
        payment_intent: intent,
      })
    }
    succeededIntent = intent
    const payment = await recordStripePayment(pool, {
      paymentIntentId: intent.id,
      amountCents: intent.amount_received || intent.amount,
      accountId: account.id,
      customerId,
    })
    if (!payment?.id) throw new Error('The successful Stripe payment was not recorded locally.')
    await linkCustomerBillingPayment(pool, {
      payment,
      chargeId: charge.id,
      accountId: account.id,
      stripeObjectId: intent.id,
      actorType: 'system',
    })
    return { intent, payment }
  } catch (error) {
    if (succeededIntent?.status === 'succeeded') {
      await pool.query(
        `UPDATE billing_charge
         SET collection_status = 'processing', stripe_payment_intent_id = $2
         WHERE id = $1`,
        [charge.id, succeededIntent.id],
      ).catch(() => {})
      await pool.query(
        `INSERT INTO stripe_billing_alert (
           family_billing_account_id, alert_type, severity, stripe_object_id, message, details
         ) VALUES ($1, 'custom_charge_reconciliation', 'critical', $2, $3, $4::jsonb)`,
        [
          account.id,
          succeededIntent.id,
          `Successful Stripe payment needs reconciliation for ${charge.description}.`,
          JSON.stringify({ chargeId: Number(charge.id), amountCents: Number(charge.amount_cents), reason: error?.message ?? String(error) }),
        ],
      ).catch(() => {})
      await recordBillingActivity(pool, {
        eventKey: `saved-card-reconciliation:${charge.id}:${succeededIntent.id}`,
        accountId: account.id,
        memberId: charge.member_id,
        chargeId: charge.id,
        eventType: 'saved_card_payment_reconciliation_required',
        summary: `Stripe accepted the saved-card charge for ${charge.description}, but local reconciliation is required.`,
        details: { amountCents: Number(charge.amount_cents), reason: error?.message ?? String(error) },
        stripeObjectId: succeededIntent.id,
        actorUserId,
      }).catch(() => {})
      throw new SavedCardCollectionError(
        'Stripe accepted this card payment, but local recording is still reconciling. Do not retry or send a fallback link.',
        { fallback: null, stripeStatus: 'succeeded' },
      )
    }
    const intent = error?.payment_intent ?? error?.raw?.payment_intent ?? null
    await pool.query(
      `UPDATE billing_charge
       SET collection_status = 'failed', stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id)
       WHERE id = $1`,
      [charge.id, intent?.id ?? null],
    )
    await pool.query(
      `INSERT INTO stripe_billing_alert (
         family_billing_account_id, alert_type, severity, stripe_object_id, message, details
       ) VALUES ($1, 'custom_charge_failed', 'warning', $2, $3, $4::jsonb)`,
      [
        account.id,
        intent?.id ?? null,
        `Saved card charge failed for ${charge.description}.`,
        JSON.stringify({ chargeId: Number(charge.id), amountCents: Number(charge.amount_cents), reason: error?.message ?? String(error) }),
      ],
    ).catch(() => {})
    await recordBillingActivity(pool, {
      eventKey: `saved-card-failed:${charge.id}:${attempt}`,
      accountId: account.id,
      memberId: charge.member_id,
      chargeId: charge.id,
      eventType: 'saved_card_payment_failed',
      summary: `Saved card charge failed for ${charge.description}.`,
      details: { amountCents: Number(charge.amount_cents), reason: error?.message ?? String(error), attempt },
      stripeObjectId: intent?.id ?? null,
      actorUserId,
    })
    let fallback = null
    try {
      fallback = await createCustomChargeCheckoutSession(pool, {
        account,
        charge,
        successUrl,
        cancelUrl,
        actorUserId,
        attemptKey: attemptKey ? `${attemptKey}-fallback` : null,
      })
    } catch {
      // The ledger charge remains due even if a fallback link cannot be created.
    }
    throw new SavedCardCollectionError(
      error?.message ?? 'Saved card charge failed; the amount remains due.',
      { fallback, stripeStatus: intent?.status ?? null },
    )
  }
}

export async function linkCustomerBillingPayment(pool, {
  payment,
  chargeId,
  accountId,
  stripeObjectId = null,
  actorType = 'stripe',
}) {
  if (!payment?.id || !chargeId || !accountId) return null
  const charge = await loadCharge(pool, accountId, chargeId)
  if (Number(payment.family_billing_account_id) !== Number(accountId)) {
    throw new Error('Payment and custom charge belong to different billing accounts.')
  }
  const amount = Number(payment.amount_cents)
  if (amount !== Number(charge.amount_cents)) {
    throw new Error('Payment amount does not exactly match the custom charge.')
  }
  const application = await applyExactPayment(pool, {
    accountId,
    paymentId: payment.id,
    chargeId: charge.id,
    amountCents: amount,
    actorType,
  })
  if (!application || Number(application.billing_payment_id) !== Number(payment.id)) {
    throw new Error('Custom charge is already linked to a different payment.')
  }
  await pool.query(
    `UPDATE billing_charge
     SET collection_status = 'paid',
         stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id)
     WHERE id = $1`,
    [charge.id, payment.stripe_payment_intent_id ?? stripeObjectId],
  )
  await recordBillingActivity(pool, {
    eventKey: `custom-charge-paid:${charge.id}:${payment.id}`,
    accountId,
    memberId: charge.member_id,
    chargeId: charge.id,
    paymentId: payment.id,
    eventType: 'custom_charge_paid',
    summary: `Payment received for ${charge.description}.`,
    afterValue: { paymentId: Number(payment.id), amountCents: amount },
    stripeObjectId: payment.stripe_payment_intent_id ?? stripeObjectId,
    actorType,
  })
  return application
}

async function accountBalance(pool, accountId) {
  const result = await pool.query(
    `SELECT
       COALESCE((SELECT SUM(amount_cents) FROM billing_charge WHERE family_billing_account_id = $1), 0)::int
       - COALESCE((SELECT SUM(amount_cents) FROM billing_payment WHERE family_billing_account_id = $1), 0)::int
       + COALESCE((SELECT SUM(amount_cents) FROM billing_refund
                   WHERE family_billing_account_id = $1 AND COALESCE(external_status, 'succeeded') = 'succeeded'), 0)::int
       AS balance_cents`,
    [accountId],
  )
  return Number(result.rows[0]?.balance_cents ?? 0)
}

export async function previewCustomerBillingRefund(pool, {
  account,
  paymentId,
  amountCents,
  ledgerTreatment,
  relatedChargeId = null,
}) {
  const amount = positiveCents(amountCents, 'Refund amount')
  if (!['reverse_charge', 'return_overpayment'].includes(ledgerTreatment)) {
    throw new Error('Choose whether the refund reverses a charge or returns an unapplied overpayment.')
  }
  const payment = await pool.query(
    `SELECT * FROM billing_payment WHERE id = $1 AND family_billing_account_id = $2`,
    [Number(paymentId), account.id],
  ).then((result) => result.rows[0])
  if (!payment?.stripe_payment_intent_id) throw new Error('Refunds must be tied to an eligible Stripe card payment.')
  if (['failed', 'canceled', 'cancelled'].includes(String(payment.external_status ?? '').toLowerCase())) {
    throw new Error('Only completed Stripe card payments can be refunded.')
  }
  const refunded = await pool.query(
    `SELECT COALESCE(SUM(amount_cents), 0)::int AS cents
     FROM billing_refund WHERE payment_id = $1 AND external_status IN ('pending', 'succeeded')`,
    [payment.id],
  )
  const remainingRefundableCents = Number(payment.amount_cents) - Number(refunded.rows[0]?.cents ?? 0)
  if (amount > remainingRefundableCents) throw new Error('Refund exceeds the remaining refundable card payment amount.')
  const currentBalanceCents = await accountBalance(pool, account.id)
  let relatedCharge = null
  if (ledgerTreatment === 'reverse_charge') {
    if (!relatedChargeId) throw new Error('Select the charge that this refund reverses or waives.')
    relatedCharge = await loadCharge(pool, account.id, relatedChargeId)
    const appliedFromPayment = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN application_kind = 'reversal' THEN -amount_cents ELSE amount_cents END), 0)::int AS cents
       FROM billing_payment_application
       WHERE billing_payment_id = $1 AND billing_charge_id = $2`,
      [payment.id, relatedCharge.id],
    )
    if (amount > Number(appliedFromPayment.rows[0]?.cents ?? 0)) {
      throw new Error('Refund amount exceeds this payment’s application to the selected charge.')
    }
    const prior = await pool.query(
      `SELECT COALESCE(SUM(amount_cents), 0)::int AS cents
       FROM billing_refund
       WHERE related_charge_id = $1 AND ledger_treatment = 'reverse_charge'
         AND external_status IN ('pending', 'succeeded')`,
      [relatedCharge.id],
    )
    if (Number(prior.rows[0]?.cents ?? 0) + amount > Math.max(0, Number(relatedCharge.amount_cents))) {
      throw new Error('Refund exceeds the remaining reversible amount on the selected charge.')
    }
  } else {
    const overpaymentCents = Math.max(0, -currentBalanceCents)
    if (amount > overpaymentCents) throw new Error('Refund exceeds the household’s unapplied overpayment.')
  }
  return {
    paymentId: Number(payment.id),
    paymentAmountCents: Number(payment.amount_cents),
    remainingRefundableCents,
    amountCents: amount,
    ledgerTreatment,
    relatedCharge: relatedCharge
      ? { id: Number(relatedCharge.id), description: relatedCharge.description, amountCents: Number(relatedCharge.amount_cents) }
      : null,
    currentBalanceCents,
    resultingBalanceCents: ledgerTreatment === 'reverse_charge'
      ? currentBalanceCents
      : currentBalanceCents + amount,
  }
}

export async function finalizeRefundLedgerTreatment(pool, refundOrId, { actorUserId = null, actorType = 'system' } = {}) {
  const refund = typeof refundOrId === 'object'
    ? refundOrId
    : await pool.query(`SELECT * FROM billing_refund WHERE id = $1`, [Number(refundOrId)]).then((result) => result.rows[0])
  if (!refund || refund.external_status !== 'succeeded' || !refund.ledger_treatment) return refund ?? null
  let offsetCredit = null
  if (refund.ledger_treatment === 'reverse_charge') {
    const result = await pool.query(
      `INSERT INTO billing_charge (
         family_billing_account_id, member_id, source_type, source_id,
         description, amount_cents, gross_amount_cents, discount_amount_cents,
         charge_type, billing_interval, related_charge_id,
         collection_status, created_by_user_id, metadata
       )
       SELECT
         $1, original.member_id, 'refund_offset', $2,
         'Credit offset for refund #' || $3, -$4, -$4, 0,
         'credit', 'one_time', original.id, 'none', $5,
         jsonb_build_object('refundId', $3, 'ledgerTreatment', 'reverse_charge')
       FROM billing_charge original WHERE original.id = $6
       ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
       RETURNING *`,
      [
        refund.family_billing_account_id,
        `refund:${refund.id}`,
        refund.id,
        Number(refund.amount_cents),
        actorUserId,
        refund.related_charge_id,
      ],
    )
    offsetCredit = result.rows[0] ?? await pool.query(
      `SELECT * FROM billing_charge WHERE source_type = 'refund_offset' AND source_id = $1`,
      [`refund:${refund.id}`],
    ).then((lookup) => lookup.rows[0] ?? null)
    if (offsetCredit) {
      await pool.query(
        `UPDATE billing_refund SET offset_credit_charge_id = $2, updated_at = now() WHERE id = $1`,
        [refund.id, offsetCredit.id],
      )
    }
  }
  const applicationReversals = await reverseRefundedApplications(pool, { refund, actorType })
  const membershipEnd = refund.ledger_treatment === 'reverse_charge'
    ? await endRefundedAnnualMembership(pool, await getStripeClient(), refund)
    : { ended: false, subscriptions: [] }
  await recordBillingActivity(pool, {
    eventKey: `refund-succeeded:${refund.id}`,
    accountId: refund.family_billing_account_id,
    chargeId: refund.related_charge_id,
    paymentId: refund.payment_id,
    refundId: refund.id,
    eventType: 'refund_succeeded',
    summary: `Refund #${refund.id} completed.`,
    afterValue: {
      amountCents: Number(refund.amount_cents),
      ledgerTreatment: refund.ledger_treatment,
      offsetCreditChargeId: offsetCredit ? Number(offsetCredit.id) : null,
      paymentApplicationReversalIds: applicationReversals.map((row) => Number(row.id)),
      annualMembershipEnded: membershipEnd.ended,
    },
    stripeObjectId: refund.stripe_refund_id,
    actorUserId,
    actorType,
  })
  return { ...refund, offset_credit_charge_id: offsetCredit?.id ?? refund.offset_credit_charge_id }
}

export async function createCustomerBillingRefund(pool, {
  account,
  actorUserId,
  paymentId,
  amountCents,
  ledgerTreatment,
  relatedChargeId = null,
  exceptionCategory,
  evidenceNote,
  reason,
  idempotencyKey = null,
}) {
  if (!stripeEnabled()) throw new Error('Stripe is not enabled; card refunds cannot be submitted.')
  const refundReason = String(reason ?? '').trim()
  if (!refundReason) throw new Error('A refund reason is required.')
  const requestKey = String(idempotencyKey ?? '').trim() || null
  if (requestKey) {
    const existing = await pool.query(
      `SELECT * FROM billing_refund WHERE request_key = $1`,
      [requestKey],
    ).then((result) => result.rows[0] ?? null)
    if (existing) {
      const sameRequest =
        Number(existing.family_billing_account_id) === Number(account.id) &&
        Number(existing.payment_id) === Number(paymentId) &&
        Number(existing.amount_cents) === Number(amountCents) &&
        String(existing.ledger_treatment ?? '') === String(ledgerTreatment ?? '') &&
        Number(existing.related_charge_id ?? 0) === Number(relatedChargeId ?? 0) &&
        String(existing.exception_category ?? '') === String(exceptionCategory ?? '') &&
        String(existing.evidence_note ?? '').trim() === String(evidenceNote ?? '').trim() &&
        String(existing.reason ?? '').trim() === refundReason
      if (!sameRequest) throw new Error('The refund request key was reused with different refund details.')
      const finalized = await finalizeRefundLedgerTreatment(pool, existing, {
        actorUserId,
        actorType: 'admin',
      })
      return { refund: finalized, preview: null, replayed: true }
    }
  }
  const preview = await previewCustomerBillingRefund(pool, {
    account,
    paymentId,
    amountCents,
    ledgerTreatment,
    relatedChargeId,
  })
  const refund = await createBillingRefund(pool, {
    accountId: account.id,
    paymentId: preview.paymentId,
    amountCents: preview.amountCents,
    reason: refundReason,
    createdByUserId: actorUserId,
    exceptionCategory,
    evidenceNote,
    ledgerTreatment,
    relatedChargeId: relatedChargeId == null ? null : Number(relatedChargeId),
    requestKey,
  })
  const finalized = await finalizeRefundLedgerTreatment(pool, refund, {
    actorUserId,
    actorType: 'admin',
  })
  if (refund.external_status !== 'succeeded') {
    await recordBillingActivity(pool, {
      eventKey: `refund-created:${refund.id}`,
      accountId: account.id,
      chargeId: relatedChargeId,
      paymentId: paymentId,
      refundId: refund.id,
      eventType: 'refund_pending',
      summary: `Refund #${refund.id} was submitted to Stripe.`,
      afterValue: { amountCents: preview.amountCents, ledgerTreatment, status: refund.external_status },
      stripeObjectId: refund.stripe_refund_id,
      actorUserId,
    })
  }
  return { refund: finalized, preview, replayed: Boolean(refund.idempotency_replayed) }
}

export async function createCustomerBillingPaymentMethodLink(pool, {
  account,
  returnUrl,
  actorUserId,
}) {
  if (!stripeEnabled()) throw new Error('Stripe is not enabled.')
  const session = await createCustomerPortalSession(pool, { account, returnUrl })
  if (!session?.url) throw new Error('Stripe did not return a payment-method update URL.')
  await recordBillingActivity(pool, {
    eventKey: `payment-method-link:${account.id}:${session.id}`,
    accountId: account.id,
    eventType: 'payment_method_link_created',
    summary: 'Secure payment-method update link created.',
    stripeObjectId: session.id,
    actorUserId,
  })
  return { url: session.url }
}

export async function loadCustomerBillingCharge(pool, accountId, chargeId) {
  return loadCharge(pool, accountId, chargeId)
}
