import { withBillingAccountCollectionLock } from '../billing/billingAccountCollectionLock.js'
import { activeLedgerChargePredicate, chargeCreditApplicationSql } from '../billing/billingLedgerSql.js'
import { createCustomerBillingChargePaymentRequest } from '../billing/customerBillingPayments.js'
import { canonicalActiveHouseholdMemberPredicate } from '../billing/householdMembership.js'
import { findBillingPaymentAttemptForStripeObject, recordAndCompleteBillingPaymentAttempt, releaseBillingPaymentAttempt } from '../billing/paymentAttemptReservations.js'
import { getStripeClient } from '../billing/stripeBilling.js'
import { publicAppUrl } from '../email/publicAppUrl.js'
import { sendDropInConfirmationNotifications } from './dropInNotificationEmail.js'
import { loadDropInDateAvailability } from './dropInOccurrences.js'
import { lockSchedulingDay } from './dayCancellation.js'
import pg from 'pg'

/** Only settled funds allocated to this athlete's drop-in charge confirm the booking. */
// A checked-out client belongs to the caller's transaction. Pool callers get
// a private transaction so calendar locks remain held through admission.
export async function confirmPaidDropIns(db, accountId, dropInId = null, { manageTransaction = false } = {}) {
  const ownsClient = typeof db.connect === 'function' && typeof db.release !== 'function' && !(db instanceof pg.Client)
  const client = ownsClient ? await db.connect() : db
  const ownsTransaction = ownsClient || manageTransaction
  try {
    if (ownsTransaction) await client.query('BEGIN')
    const candidates = (await client.query(`SELECT booking.id,booking.slot_group_id,booking.class_date::text AS class_date,p.facility_id
      FROM drop_in_registration booking JOIN scheduling_form sf ON sf.id=booking.form_id
      JOIN program p ON p.id=sf.program_id JOIN billing_charge charge ON charge.source_type='drop_in'
        AND charge.source_id=booking.id::text AND charge.member_id=booking.member_id
      WHERE charge.family_billing_account_id=$1 AND booking.status='payment_pending'
        AND booking.amount_cents>0 AND ($2::bigint IS NULL OR booking.id=$2)
      ORDER BY p.facility_id,booking.class_date,booking.slot_group_id,booking.id`, [accountId,dropInId])).rows
    for (const key of [...new Set(candidates.map(row => `${row.facility_id}:${row.class_date}`))].sort()) {
      const [facilityId,date] = key.split(':')
      await lockSchedulingDay(client, Number(facilityId), date, { shared: true })
    }
    const groups = [...new Set(candidates.map(row => Number(row.slot_group_id)))].sort((a,b)=>a-b)
    if (groups.length) await client.query('SELECT id FROM scheduling_slot_group WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE', [groups])
    const eligible = []
    for (const booking of candidates) {
      if ((await loadDropInDateAvailability(client, booking.slot_group_id, booking.class_date)).allowsDropIn) eligible.push(Number(booking.id))
    }
    const result = eligible.length ? await client.query(
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
        AND booking.id=ANY($3::bigint[])
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
    [accountId, dropInId, eligible],
  ) : { rows: [] }
    if (ownsTransaction) await client.query('COMMIT')
    return result.rows.map((row) => Number(row.id))
  } catch (error) {
    if (ownsTransaction) await client.query('ROLLBACK').catch(()=>{})
    throw error
  } finally {
    if (ownsClient) client.release()
  }
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

export async function checkoutDropIn(pool, { account, dropInId, checkoutSessionId = null }, { loadStripeClient = getStripeClient } = {}) {
  const result = await withBillingAccountCollectionLock(pool, account.id, async (db) => {
    const booking = (await db.query(
      `SELECT charge.*, booking.status AS booking_status, booking.slot_group_id, booking.class_date::text AS class_date,
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

    let confirmed = await confirmPaidDropIns(db, account.id, dropInId, { manageTransaction: true })
    if (confirmed.length) return { status: 'confirmed', confirmed }
    const { cancelled } = await loadDropInDateAvailability(db, booking.slot_group_id, booking.class_date)
    const cancelledMessage = 'This class has been canceled for that date. Please choose another date.'
    const assertStillPayable = async () => {
      const availability = await loadDropInDateAvailability(db, booking.slot_group_id, booking.class_date)
      if (availability.cancelled) throw checkoutError(cancelledMessage, 409)
      if (!availability.allowsDropIn) throw checkoutError('This class time is no longer available for drop-ins. Please choose another date.', 409)
    }
    if (cancelled && !checkoutSessionId) throw checkoutError(cancelledMessage, 409)
    const stripe = await loadStripeClient()
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
        confirmed = await confirmPaidDropIns(db, account.id, dropInId, { manageTransaction: true })
        if (!confirmed.length) {
          const finalAvailability = await loadDropInDateAvailability(db, booking.slot_group_id, booking.class_date)
          if (finalAvailability.cancelled || !finalAvailability.allowsDropIn) throw checkoutError('Payment was received, but this class time is no longer available. Please contact Vortex Athletics so we can arrange a make-up class or review your payment.', 409)
        }
        return confirmed.length ? { status: 'confirmed', confirmed } : { status: 'payment_pending' }
      }
      // The provider lookup may outlast a calendar edit. Never resume an open
      // payment URL based on the availability snapshot from before that await.
      await assertStillPayable()
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
    await assertStillPayable()

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
