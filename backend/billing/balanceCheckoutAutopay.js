import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { recordBillingActivity } from './billingActivity.js'
import { preserveEnrollmentCheckoutPaymentMethod } from './stripeEnrollmentCheckout.js'

const objectId = value => typeof value === 'string' ? value : value?.id ?? null

/** Complete an explicit balance-Checkout opt-in only after exact settlement.
 * No collection or subscription creation occurs here. Replays cannot replace a
 * newer default after this choice has already been applied. */
export async function completeBalanceCheckoutAutopay(pool, { session, stripe }) {
  if (session?.metadata?.checkoutType !== 'outstanding_balance'
    || session?.metadata?.balanceAutopayConsent !== 'v1') return { saved: false }
  const accountId = Number(session.metadata.familyBillingAccountId)
  const attemptId = Number(session.metadata.billingPaymentAttemptId)
  if (!Number.isSafeInteger(accountId) || accountId <= 0 || !Number.isSafeInteger(attemptId) || attemptId <= 0) {
    throw new Error('Balance Checkout autopay has no valid account or payment attempt.')
  }
  return withBillingAccountCollectionLock(pool, accountId, async db => {
    const attempt = (await db.query(`/* balance-checkout-autopay:settled-attempt */
      SELECT attempt.*, payment.stripe_customer_id AS paid_customer_id,
        payment.stripe_payment_intent_id AS paid_intent_id,
        payment.stripe_checkout_session_id AS paid_session_id,
        payment.amount_cents AS paid_amount_cents
      FROM billing_payment_attempt attempt
      JOIN billing_payment payment ON payment.id=attempt.billing_payment_id
        AND payment.family_billing_account_id=attempt.family_billing_account_id
        AND payment.external_status IN ('settled','succeeded')
      WHERE attempt.id=$1 AND attempt.family_billing_account_id=$2`, [attemptId, accountId])).rows[0]
    if (!attempt || attempt.status !== 'succeeded'
      || attempt.metadata?.savePaymentMethodForAutopay !== true
      || attempt.metadata?.autopayConsentVersion !== 'v1'
      || attempt.stripe_checkout_session_id !== session.id
      // Balance settlements own the Checkout link on the durable attempt;
      // the payment itself is bound by its exact PaymentIntent below.
      || (attempt.paid_session_id != null && attempt.paid_session_id !== session.id)) {
      throw new Error('Balance Checkout autopay requires a settled payment with recorded consent.')
    }
    if (attempt.metadata?.balanceAutopayCompleted) return { saved: true, replayed: true }
    const remote = await stripe.checkout.sessions.retrieve(session.id, { expand: ['payment_intent.payment_method'] })
    const intent = remote.payment_intent
    if (remote.id !== session.id || remote.mode !== 'payment' || remote.status !== 'complete'
      || remote.payment_status !== 'paid' || remote.metadata?.checkoutType !== 'outstanding_balance'
      || remote.metadata?.balanceAutopayConsent !== 'v1'
      || remote.metadata?.familyBillingAccountId !== String(accountId)
      || remote.metadata?.billingPaymentAttemptId !== String(attemptId)
      || objectId(remote.customer) !== attempt.paid_customer_id
      || objectId(intent) !== attempt.paid_intent_id
      || intent?.status !== 'succeeded' || intent.setup_future_usage !== 'off_session'
      || objectId(intent.customer) !== attempt.paid_customer_id
      || remote.currency !== 'usd' || intent.currency !== 'usd'
      || remote.amount_total !== Number(attempt.amount_cents)
      || intent.amount_received !== Number(attempt.amount_cents)
      || Number(attempt.paid_amount_cents) !== Number(attempt.amount_cents)
      || !objectId(intent.payment_method)) {
      throw new Error('Balance Checkout autopay could not verify the paid session and reusable payment method.')
    }
    const result = await preserveEnrollmentCheckoutPaymentMethod(db, stripe, {
      familyBillingAccountId: accountId,
      customerId: attempt.paid_customer_id,
      defaultPaymentMethodId: objectId(intent.payment_method),
      idempotencyKey: `balance-checkout-autopay:${attemptId}:v1`,
    })
    await db.query('BEGIN')
    try {
      await recordBillingActivity(db, {
        eventKey: `balance-checkout-autopay:${attemptId}:v1`, accountId,
        paymentId: attempt.billing_payment_id, actorType: 'stripe',
        eventType: 'payment_method_saved_for_autopay',
        summary: 'Payment method saved as the household autopay default with permission during balance Checkout.',
        details: { checkoutSessionId: session.id, paymentMethodId: result.defaultPaymentMethodId,
          consentVersion: 'v1', consentAt: attempt.metadata.autopayConsentAt },
        stripeObjectId: session.id,
      })
      await db.query(`UPDATE billing_payment_attempt SET metadata=metadata || jsonb_build_object(
        'balanceAutopayCompleted',true,'balanceAutopayCompletedAt',now()),updated_at=now() WHERE id=$1`, [attemptId])
      await db.query('COMMIT')
    } catch (error) { await db.query('ROLLBACK'); throw error }
    return { saved: true, paymentMethodId: result.defaultPaymentMethodId }
  })
}
