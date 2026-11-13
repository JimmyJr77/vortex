import { withBillingAccountCollectionLock } from '../billing/billingAccountCollectionLock.js'
import { activeLedgerChargePredicate, chargeCreditApplicationSql } from '../billing/billingLedgerSql.js'
import { createCustomerBillingChargePaymentRequest } from '../billing/customerBillingPayments.js'
import { canonicalActiveHouseholdMemberPredicate } from '../billing/householdMembership.js'
import { findBillingPaymentAttemptForStripeObject, recordAndCompleteBillingPaymentAttempt, releaseBillingPaymentAttempt } from '../billing/paymentAttemptReservations.js'
import { getStripeClient } from '../billing/stripeBilling.js'
import { publicAppUrl } from '../email/publicAppUrl.js'
import { sendDropInConfirmationNotifications } from './dropInNotificationEmail.js'

/** Only settled funds allocated to this athlete's drop-in charge confirm the booking. */
export async function confirmPaidDropIns(db, accountId, dropInId = null) {
  const result = await db.query(
    `UPDATE drop_in_registration booking
        SET status = 'confirmed', updated_at = now()
       FROM billing_charge charge
      WHERE charge.family_billing_account_id = $1
        AND charge.source_type = 'drop_in'
        AND charge.source_id = booking.id::text
        AND charge.member_id = booking.member_id
        AND ${activeLedgerChargePredicate('charge')}
        AND booking.status = 'payment_pending'
        AND booking.amount_cents > 0
        AND ($2::bigint IS NULL OR booking.id = $2)
        AND GREATEST(1, charge.amount_cents + COALESCE((
          SELECT SUM(adjustment.amount_cents) FROM billing_charge adjustment
           WHERE adjustment.related_charge_id = charge.id AND adjustment.source_type = 'charge_adjustment'
        ), 0)) <= (
          SELECT COALESCE(SUM(CASE WHEN application.application_kind = 'reversal'
                                   THEN -application.amount_cents ELSE application.amount_cents END), 0)
            FROM billing_payment_application application
            JOIN billing_payment payment ON payment.id = application.billing_payment_id
           WHERE application.billing_charge_id = charge.id
             AND payment.family_billing_account_id = $1
             AND payment.external_status IN ('settled', 'succeeded')
        ) + (${chargeCreditApplicationSql('charge.id')})
      RETURNING booking.id`,
    [accountId, dropInId],
  )
  return result.rows.map((row) => Number(row.id))
}

export async function notifyPaidDropIns(pool, ids) {
  for (const id of ids) {
    await sendDropInConfirmationNotifications(pool, id).catch((error) => {
      console.error('[drop-ins] confirmation notifications:', error?.message || error)
    })
  }
}

function checkoutError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode })
}

export async function checkoutDropIn(pool, { account, dropInId, checkoutSessionId = null }) {
  const result = await withBillingAccountCollectionLock(pool, account.id, async (db) => {
    const booking = (await db.query(
      `SELECT charge.*, booking.status AS booking_status,
              booking.class_date >= (now() AT TIME ZONE facility.timezone)::date AS upcoming
         FROM drop_in_registration booking
         JOIN billing_charge charge ON charge.source_type = 'drop_in'
          AND charge.source_id = booking.id::text AND charge.member_id = booking.member_id
         JOIN family_billing_account billing_account ON billing_account.id = charge.family_billing_account_id
         JOIN family ON family.id = billing_account.family_id
         JOIN facility ON facility.id = family.facility_id
         JOIN member athlete ON athlete.id = booking.member_id AND athlete.facility_id = facility.id
        WHERE booking.id = $1 AND billing_account.id = $2
          AND booking.benefit_type = 'paid' AND booking.amount_cents > 0
          AND ${canonicalActiveHouseholdMemberPredicate({ memberAlias: 'athlete', familyIdReference: 'family.id' })}
          AND ${activeLedgerChargePredicate('charge')}`,
      [dropInId, account.id],
    )).rows[0]
    if (!booking) throw checkoutError('Drop-in booking was not found.', 404)
    if (booking.booking_status === 'confirmed' || booking.booking_status === 'attended') return { status: 'confirmed' }
    if (booking.booking_status !== 'payment_pending') throw checkoutError('This drop-in is no longer available for payment.', 409)

    let confirmed = await confirmPaidDropIns(db, account.id, dropInId)
    if (confirmed.length) return { status: 'confirmed', confirmed }
    const stripe = await getStripeClient()
    if (!stripe) throw checkoutError('Online payments are unavailable. Your booking is awaiting payment.', 503)

    let latest = (await db.query(
      `SELECT id, request_key, status, stripe_checkout_session_id
         FROM billing_payment_attempt
        WHERE family_billing_account_id = $1 AND target_charge_id = $2 AND attempt_type = 'charge_checkout'
        ORDER BY id DESC LIMIT 1`,
      [account.id, booking.id],
    )).rows[0]
    const sessionId = checkoutSessionId || latest?.stripe_checkout_session_id
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      const attempt = await findBillingPaymentAttemptForStripeObject(db, session)
      if (Number(attempt?.family_billing_account_id) !== Number(account.id)
        || Number(attempt?.target_charge_id) !== Number(booking.id)) {
        throw checkoutError('Checkout does not match this booking.', 404)
      }
      if (session.status === 'complete' && session.payment_status === 'paid' && session.mode === 'payment') {
        const settlement = await recordAndCompleteBillingPaymentAttempt(db, {
          stripeObject: session,
          paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
          amountCents: session.amount_total,
          customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
        })
        if (settlement?.conflicted) throw checkoutError('Payment needs staff review before this drop-in can be confirmed.', 409)
        confirmed = await confirmPaidDropIns(db, account.id, dropInId)
        return confirmed.length ? { status: 'confirmed', confirmed } : { status: 'payment_pending' }
      }
      if (checkoutSessionId) return { status: 'payment_pending' }
      if (session.status === 'expired' && session.payment_status !== 'paid') {
        latest = await releaseBillingPaymentAttempt(db, {
          attemptId: attempt.id, stripeObject: session, status: 'expired', checkoutTerminal: true,
        })
      } else if (session.status === 'open' && session.url && booking.upcoming) {
        return { status: 'payment_pending', url: session.url }
      } else {
        return { status: 'payment_pending' }
      }
    }
    if (!booking.upcoming) throw checkoutError('This class date has passed.', 409)

    const canResume = latest && ['reserved', 'pending', 'processing', 'reconciliation_required'].includes(latest.status)
    const base = `${publicAppUrl()}/drop-in?booking=${dropInId}`
    const checkout = await createCustomerBillingChargePaymentRequest(db, {
      account,
      charge: booking,
      successUrl: `${base}&checkout=paid&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}&checkout=cancelled`,
      attemptKey: canResume ? latest.request_key : `drop-in-${dropInId}-after-${latest?.id ?? 'start'}`,
      paymentMethodTypes: ['card', 'link'],
    })
    return { status: 'payment_pending', url: checkout.url }
  })
  await notifyPaidDropIns(pool, result.confirmed ?? [])
  return { status: result.status, url: result.url }
}
