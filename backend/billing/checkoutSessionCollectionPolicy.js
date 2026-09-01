import { recordStripeBillingAlert } from './stripeOperations.js'

export const FORBIDDEN_SUBSCRIPTION_CHECKOUT_CODE = 'STRIPE_CHECKOUT_SUBSCRIPTION_MODE_FORBIDDEN'

function stripeId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
}

export function checkoutSessionSubscriptionId(session) {
  return stripeId(session?.subscription)
}

export function checkoutSessionHasForbiddenSubscriptionCollector(session) {
  return session?.mode === 'subscription' || Boolean(checkoutSessionSubscriptionId(session))
}

function quarantineMessage(session, checkoutKind) {
  const sessionId = session?.id ?? 'unknown'
  const subscriptionId = checkoutSessionSubscriptionId(session)
  const kind = checkoutKind === 'annual_membership' ? 'annual membership' : 'enrollment'
  return [
    `Blocked stale ${kind} Checkout Session ${sessionId} because it can create a Stripe subscription collector.`,
    subscriptionId ? `Remote subscription ${subscriptionId} requires reviewed retirement.` : null,
  ].filter(Boolean).join(' ')
}

/**
 * Fail closed before any entitlement commit and leave durable operator evidence.
 * A completed subscription-mode Session cannot be made safe by merely ignoring
 * its Subscription id: the remote collector must be reviewed and retired.
 */
export async function rejectForbiddenSubscriptionCheckoutCompletion(pool, {
  session,
  checkoutKind,
  pendingEnrollmentId = null,
  accountId = null,
}) {
  if (!checkoutSessionHasForbiddenSubscriptionCollector(session)) return

  const sessionId = String(session?.id ?? '').trim()
  const subscriptionId = checkoutSessionSubscriptionId(session)
  const resolvedAccountId = Number(accountId ?? session?.metadata?.familyBillingAccountId) || null
  const message = quarantineMessage(session, checkoutKind)

  if (pendingEnrollmentId != null) {
    const pendingId = Number(pendingEnrollmentId)
    if (Number.isSafeInteger(pendingId) && pendingId > 0) {
      await pool.query(
        `UPDATE stripe_pending_enrollment
            SET status = CASE WHEN status = 'completed' THEN status ELSE 'failed' END,
                error_message = $2,
                updated_at = now()
          WHERE id = $1`,
        [pendingId, message.slice(0, 500)],
      )
    }
  }

  await recordStripeBillingAlert(pool, {
    event: { id: `forbidden-subscription-checkout:${sessionId || subscriptionId || 'unknown'}` },
    object: {
      ...session,
      reason: message,
      metadata: {
        ...(session?.metadata ?? {}),
        ...(resolvedAccountId ? { familyBillingAccountId: String(resolvedAccountId) } : {}),
      },
    },
    alertType: 'forbidden_subscription_checkout',
    severity: 'critical',
    message,
  })

  const error = new Error(message)
  error.code = FORBIDDEN_SUBSCRIPTION_CHECKOUT_CODE
  error.statusCode = 409
  error.checkoutKind = checkoutKind
  error.stripeCheckoutSessionId = sessionId || null
  error.stripeSubscriptionId = subscriptionId
  throw error
}
