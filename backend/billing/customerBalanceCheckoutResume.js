import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { getStripeClient } from './stripeBilling.js'

/** Local candidate only. The Stripe Session must be checked before its URL is shown. */
export async function loadPendingMemberBalanceCheckout(pool, account) {
  const { rows } = await pool.query(
    `SELECT attempt.id, attempt.amount_cents, attempt.stripe_checkout_session_id,
            attempt.stripe_payment_intent_id, account.stripe_customer_id
       FROM billing_payment_attempt attempt
       JOIN family_billing_account account ON account.id = attempt.family_billing_account_id
       JOIN family ON family.id = account.family_id
      WHERE attempt.family_billing_account_id = $1
        AND family.facility_id = $2
        AND account.is_active = TRUE
        AND account.stripe_customer_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM family_billing_account other
           WHERE other.stripe_customer_id = account.stripe_customer_id
             AND other.id <> account.id
        )
        AND attempt.attempt_type = 'member_balance_checkout'
        AND attempt.status = 'pending'
        AND attempt.expires_at > now()
        AND attempt.stripe_checkout_session_id IS NOT NULL
      ORDER BY attempt.id
      LIMIT 2`,
    [Number(account.id), Number(account.family_facility_id)],
  )
  return rows.length === 1 ? rows[0] : null
}

function stripeId(value) {
  return typeof value === 'string' ? value : value?.id
}

function checkoutUnavailable() {
  return Object.assign(new Error('The existing checkout is no longer available to reopen. Refresh the account to check its payment status.'), { statusCode: 409 })
}

/** Reopen only the exact, still-payable Session. This never creates or expires one. */
export async function resumeMemberBalanceCheckout(pool, {
  account, stripeClient = undefined, now = null,
}) {
  return withBillingAccountCollectionLock(pool, account.id, async (db) => {
    const attempt = await loadPendingMemberBalanceCheckout(db, account)
    if (!attempt) throw checkoutUnavailable()

    const stripe = stripeClient === undefined ? await getStripeClient() : stripeClient
    if (!stripe) throw Object.assign(new Error('Stripe is unavailable.'), { statusCode: 503 })

    let session
    try {
      session = await stripe.checkout.sessions.retrieve(attempt.stripe_checkout_session_id, {
        expand: ['payment_intent'],
      })
    } catch (error) {
      if (error?.code === 'resource_missing') throw checkoutUnavailable()
      throw Object.assign(new Error('Stripe could not verify the existing checkout. Try again after refreshing the account.'), { statusCode: 503 })
    }

    const amountCents = Number(attempt.amount_cents)
    const hasMatchingMetadata = (object) => (
      object?.metadata?.checkoutType === 'outstanding_balance'
      && object.metadata.familyBillingAccountId === String(account.id)
      && object.metadata.billingPaymentAttemptId === String(attempt.id)
    )
    if (
      session?.id !== attempt.stripe_checkout_session_id
      || session.mode !== 'payment'
      || session.status !== 'open'
      || session.payment_status !== 'unpaid'
      || !Number.isInteger(session.expires_at)
      || session.expires_at * 1000 <= (now?.getTime() ?? Date.now())
      || session.client_reference_id !== `family-billing-account:${account.id}`
      || stripeId(session.customer) !== attempt.stripe_customer_id
      || !hasMatchingMetadata(session)
      || session.currency !== 'usd'
      || session.amount_total !== amountCents
    ) throw checkoutUnavailable()

    const intent = session.payment_intent
    if (intent === undefined) throw checkoutUnavailable()
    if (attempt.stripe_payment_intent_id && stripeId(intent) !== attempt.stripe_payment_intent_id) {
      throw checkoutUnavailable()
    }
    if (intent && (
      !['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(intent.status)
      || intent.amount_received !== 0
      || intent.amount_capturable !== 0
      || intent.amount !== amountCents
      || intent.currency !== 'usd'
      || stripeId(intent.customer) !== attempt.stripe_customer_id
      || !hasMatchingMetadata(intent)
    )) throw checkoutUnavailable()

    if (typeof session.url !== 'string' || !URL.canParse(session.url)) throw checkoutUnavailable()
    const url = new URL(session.url)
    if (url.protocol !== 'https:' || url.username || url.password) throw checkoutUnavailable()

    return { url: session.url, amountCents }
  })
}
