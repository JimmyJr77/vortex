import { notifyPaymentReceipt } from '../email/memberNotifications.js'
import { publicAppUrl } from '../email/publicAppUrl.js'
import { confirmPaidDropIns, notifyPaidDropIns } from '../scheduling/dropInCheckout.js'
import { recordBillingActivityBestEffort } from './billingActivity.js'
import { HOUSEHOLD_INVOICE_RESERVING_STATUSES, loadCanonicalCollectibleBalanceCents } from './canonicalBillingAccount.js'
import { loadCustomerBillingAccount } from './customerBillingQueries.js'
import { allocateHouseholdPayments } from './paymentAllocation.js'
import {
  TERMINAL_BILLING_ATTEMPT_TYPE,
  assertTerminalBillingPaymentIntent,
  attachBillingPaymentAttemptStripeObject,
  loadBillingPaymentAttemptByRequestKey,
  markBillingPaymentAttemptRemotePending,
  recordAndCompleteBillingPaymentAttempt,
  releaseBillingPaymentAttempt,
  reserveBillingPaymentAttempt,
  withBillingAccountCollectionLock,
} from './paymentAttemptReservations.js'
import { ensureStripeCustomer, prepareStripePaymentRecord } from './stripeBilling.js'

function billingTerminalError(message, statusCode = 409) {
  return Object.assign(new Error(message), { statusCode })
}

export async function prepareBillingTerminalPayment(pool, {
  facilityId, targetId, actorUserId, attemptId, stripe, expectedAmountCents,
}) {
  if (![facilityId, targetId].every((id) => Number.isSafeInteger(Number(id)) && Number(id) > 0)) {
    throw billingTerminalError('Select a billing account to accept an in-person payment.', 400)
  }
  if (typeof attemptId !== 'string' || !attemptId) {
    throw billingTerminalError('An in-person payment attempt ID is required.', 400)
  }
  const account = await loadCustomerBillingAccount(pool, targetId, facilityId)
  if (!account) throw billingTerminalError('Active family billing account was not found.', 404)

  return withBillingAccountCollectionLock(pool, account.id, async (db) => {
    const currentAccount = await loadCustomerBillingAccount(db, targetId, facilityId)
    if (!currentAccount || Number(currentAccount.id) !== Number(account.id)) {
      throw billingTerminalError('Active family billing account was not found.', 404)
    }

    let reservation = await loadBillingPaymentAttemptByRequestKey(db, {
      accountId: account.id,
      attemptType: TERMINAL_BILLING_ATTEMPT_TYPE,
      requestKey: attemptId,
    })
    if (!reservation) {
      // The invoice may still collect through its hosted page or on its own
      // schedule. Only the invoice workflow can settle the balance it owns.
      const openInvoice = await db.query(
        `SELECT id FROM billing_monthly_invoice
          WHERE family_billing_account_id = $1 AND status = ANY($2::text[])
          LIMIT 1`,
        [account.id, HOUSEHOLD_INVOICE_RESERVING_STATUSES],
      )
      if (openInvoice.rows[0]) {
        throw billingTerminalError('This account has an open monthly invoice. Use the invoice payment link to pay it.')
      }

      const amountCents = await loadCanonicalCollectibleBalanceCents(db, account.id)
      if (amountCents <= 0) {
        throw billingTerminalError('This account has no unpaid balance available for in-person payment.')
      }
      if (amountCents < 50) {
        throw billingTerminalError('Stripe requires at least $0.50 for an in-person card payment.')
      }
      if (amountCents !== expectedAmountCents) {
        throw billingTerminalError('The balance changed. Refresh the account and confirm the current amount.')
      }
      const customerId = await ensureStripeCustomer(db, stripe, currentAccount)
      reservation = await reserveBillingPaymentAttempt(db, {
        accountId: account.id,
        attemptType: TERMINAL_BILLING_ATTEMPT_TYPE,
        requestKey: attemptId,
        amountCents,
        metadata: { actorUserId, terminalAttemptId: attemptId, stripeCustomerId: customerId },
      })
    }
    if (['canceled', 'expired', 'failed'].includes(reservation.status)) {
      throw billingTerminalError('This in-person payment attempt is closed. Start a new payment.')
    }

    // Stripe creation follows this call. Keep the reservation if the app
    // crashes before the PaymentIntent can be linked or Stripe is unreachable.
    await markBillingPaymentAttemptRemotePending(db, reservation.id)
    return {
      amountCents: reservation.amount_cents,
      customerId: reservation.metadata.stripeCustomerId,
      metadata: {
        billingPaymentAttemptId: String(reservation.id),
        familyBillingAccountId: String(account.id),
        terminalAttemptId: attemptId,
      },
    }
  })
}

async function loadTerminalBillingReservation(pool, attempt) {
  const result = await pool.query(
    `SELECT reservation.*
       FROM billing_payment_attempt reservation
       JOIN family_billing_account account ON account.id = reservation.family_billing_account_id
       JOIN family ON family.id = account.family_id
      WHERE family.id = $1 AND family.facility_id = $2
        AND reservation.attempt_type = $3 AND reservation.request_key = $4`,
    [attempt.target_id, attempt.facility_id, TERMINAL_BILLING_ATTEMPT_TYPE, attempt.id],
  )
  return result.rows[0] ?? null
}

export async function bindBillingTerminalPayment(pool, { attempt, intent }) {
  const reservation = await loadTerminalBillingReservation(pool, attempt)
  if (!reservation) throw billingTerminalError('The billing reservation for this in-person payment was not found.')
  assertTerminalBillingPaymentIntent(reservation, intent)
  const bound = await attachBillingPaymentAttemptStripeObject(pool, {
    attemptId: reservation.id,
    paymentIntentId: intent.id,
    status: intent.status === 'succeeded' ? 'processing' : 'pending',
  })
  if (bound.stripe_payment_intent_id !== intent.id || ['failed', 'expired', 'canceled'].includes(bound.status)) {
    throw billingTerminalError('The billing reservation for this in-person payment is closed.')
  }
}

export async function settleBillingTerminalPayment(pool, { attempt, intent, stripe }) {
  await bindBillingTerminalPayment(pool, { attempt, intent })
  const settlement = await recordAndCompleteBillingPaymentAttempt(pool, {
    stripeObject: intent,
    paymentIntentId: intent.id,
    amountCents: Number(attempt.amount_cents),
    customerId: attempt.stripe_customer_id,
    preparePaymentFunction: (details) => prepareStripePaymentRecord(details, { stripe }),
  })
  if (!settlement?.payment || settlement.conflicted) {
    throw billingTerminalError(settlement?.reason || 'This in-person payment requires billing reconciliation.')
  }

  const payment = settlement.payment
  const accountId = settlement.attempt.family_billing_account_id
  await allocateHouseholdPayments(pool, { accountId, actorType: 'stripe' })
  await notifyPaidDropIns(pool, await confirmPaidDropIns(pool, accountId))
  await recordBillingActivityBestEffort(pool, {
    eventKey: `stripe-payment-received:${payment.id}`,
    accountId,
    paymentId: payment.id,
    eventType: 'payment_received',
    summary: 'In-person card payment received.',
    details: { amountCents: Number(payment.amount_cents) },
    stripeObjectId: intent.id,
    actorUserId: attempt.actor_user_id,
    actorType: 'stripe',
  })

  const account = (await pool.query('SELECT * FROM family_billing_account WHERE id = $1', [accountId])).rows[0]
  if (account) {
    await notifyPaymentReceipt(pool, {
      account,
      payment,
      billingUrl: `${publicAppUrl()}/?billing=portal-return`,
      idempotencyKey: `stripe-payment-receipt:${payment.id}`,
    })
  }
  return { paymentId: Number(payment.id) }
}

export async function releaseBillingTerminalPayment(pool, { attempt, intent }) {
  const reservation = await loadTerminalBillingReservation(pool, attempt)
  if (!reservation) return

  await withBillingAccountCollectionLock(pool, reservation.family_billing_account_id, async (db) => {
    const current = await loadTerminalBillingReservation(db, attempt)
    if (current?.status === 'canceled') return
    if (!current || current.status === 'succeeded' || (intent ? intent.status !== 'canceled' : current.stripe_payment_intent_id)) {
      throw billingTerminalError('The Stripe payment must be confirmed canceled before releasing the billing balance.')
    }
    if (intent) {
      assertTerminalBillingPaymentIntent(current, intent)
      if (!current.stripe_payment_intent_id) {
        await attachBillingPaymentAttemptStripeObject(db, {
          attemptId: current.id,
          paymentIntentId: intent.id,
          status: 'pending',
        })
      }
    }
    await releaseBillingPaymentAttempt(db, {
      attemptId: current.id,
      stripeObject: intent,
      status: 'canceled',
      reason: 'In-person card payment canceled.',
      remoteCreationDefinitelyNotStarted: !intent,
    })
  })
}
