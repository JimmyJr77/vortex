import { beginStripeWebhookEvent, completeStripeWebhookEvent, failStripeWebhookEvent } from './stripeOperations.js'
import { syncStripeSubscriptionStatus } from './stripeWebhookLifecycle.js'
import { CUSTOMER_PROJECTION_EVENT_TYPES, refreshStripeCustomerProjectionForEvent } from './stripeCustomerProjection.js'

const SUBSCRIPTION_EVENTS = Object.freeze([
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'customer.subscription.paused', 'customer.subscription.resumed',
])

/** Recover state-sync failures using the same durable leases as webhook delivery.
 * Each handler retrieves current remote state; stale payloads cannot reverse it.
 * Payment/refund fulfillment retains its existing dedicated recovery handlers.
 */
export async function retryStripeStateWebhooks(pool, stripe, {
  limit = 100,
  begin = beginStripeWebhookEvent,
  complete = completeStripeWebhookEvent,
  fail = failStripeWebhookEvent,
  syncSubscription = syncStripeSubscriptionStatus,
  refreshCustomer = refreshStripeCustomerProjectionForEvent,
} = {}) {
  const rows = await pool.query(
    `SELECT event_id, event_type FROM stripe_webhook_event
      WHERE event_type = ANY($1::text[])
        AND (status='failed' OR (status='processing'
          AND COALESCE(lease_expires_at, updated_at + interval '15 minutes') <= now()))
      ORDER BY updated_at, event_id LIMIT $2`,
    [[...CUSTOMER_PROJECTION_EVENT_TYPES, ...SUBSCRIPTION_EVENTS], Math.min(500, Math.max(1, Number(limit) || 100))],
  )
  const summary = { checked: rows.rows.length, completed: 0, failed: 0, inProgress: 0 }
  for (const row of rows.rows) {
    const eventRef = { id: row.event_id, type: row.event_type }
    // Claim before fetching to retain attempts and fair retry order even if
    // Stripe temporarily cannot serve the event or it has aged out remotely.
    const claim = await begin(pool, eventRef)
    if (claim.replayed) continue
    if (!claim.claimed) { summary.inProgress += 1; continue }
    try {
      const event = await stripe.events.retrieve(row.event_id)
      if (event?.id !== row.event_id || event?.type !== row.event_type || !event?.data?.object?.id) {
        throw new Error('Stripe state retry did not return its exact event identity.')
      }
      if (SUBSCRIPTION_EVENTS.includes(event.type)) {
        await syncSubscription(pool, event.data.object, event.type, { stripe })
      } else {
        await refreshCustomer(pool, stripe, event)
      }
      await complete(pool, event, claim)
      summary.completed += 1
    } catch (error) {
      await fail(pool, eventRef, error, claim)
      summary.failed += 1
    }
  }
  return summary
}
