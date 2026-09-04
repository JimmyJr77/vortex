import { getStripeClient } from './stripeBilling.js'
import { recordBillingActivityBestEffort } from './billingActivity.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { guardLegacyRemoteSubscriptionMutation } from './remoteSubscriptionMutationGuard.js'

/**
 * Changes only the future renewal behavior of an annual membership.  The
 * active paid-through period is deliberately never shortened or cancelled.
 * Both the admin and member endpoints use this one locked service so their
 * Stripe and ledger behavior cannot drift.
 */
export async function setAnnualMembershipAutoRenewal(pool, {
  account,
  subscriptionId,
  enabled,
  actorUserId = null,
  actorType = 'admin',
}) {
  if (!account?.id) throw new Error('Family billing account was not found.')
  if (!Number.isFinite(Number(subscriptionId)) || Number(subscriptionId) <= 0) {
    const error = new Error('Annual membership subscription was not found.')
    error.statusCode = 404
    throw error
  }
  if (typeof enabled !== 'boolean') {
    const error = new Error('enabled must be true or false.')
    error.statusCode = 400
    throw error
  }

  return withBillingAccountCollectionLock(pool, account.id, async (db) => {
    const existing = (
      await db.query(
        `SELECT * FROM billing_subscription
         WHERE id = $1
           AND family_billing_account_id = $2
           AND (source_type = 'annual_membership' OR pricing_option_key = 'annual_membership')
         LIMIT 1`,
        [Number(subscriptionId), Number(account.id)],
      )
    ).rows[0]
    if (!existing) {
      const error = new Error('Individual annual membership was not found.')
      error.statusCode = 404
      throw error
    }
    if (existing.status === 'cancelled') {
      const error = new Error('A cancelled membership subscription cannot be resumed.')
      error.statusCode = 409
      throw error
    }

    let remoteMutation = null
    if (existing.stripe_subscription_id) {
      remoteMutation = await guardLegacyRemoteSubscriptionMutation(db, {
        accountId: Number(account.id),
        stripeSubscriptionId: existing.stripe_subscription_id,
        operation: enabled
          ? 'annual-membership-auto-renew-enable'
          : 'annual-membership-auto-renew-disable',
      })
      if (remoteMutation.allowed) {
        const stripe = await getStripeClient()
        if (!stripe) throw new Error('Stripe is unavailable.')
        await stripe.subscriptions.update(existing.stripe_subscription_id, {
          cancel_at_period_end: !enabled,
        })
      }
    }

    const saved = (
      await db.query(
        `UPDATE billing_subscription
            SET auto_renewal = $2, updated_at = now()
          WHERE id = $1
          RETURNING *`,
        [Number(subscriptionId), enabled],
      )
    ).rows[0]
    await recordBillingActivityBestEffort(db, {
      eventKey: `annual-membership-auto-renewal:${subscriptionId}:${enabled}:${new Date(saved.updated_at).getTime()}`,
      accountId: Number(account.id),
      memberId: saved.member_id == null ? null : Number(saved.member_id),
      eventType: 'annual_membership_auto_renewal_changed',
      summary: `Annual membership auto-renewal was ${enabled ? 'enabled' : 'cancelled'} for one member.`,
      beforeValue: { autoRenewal: existing.auto_renewal !== false },
      afterValue: { autoRenewal: enabled },
      details: {
        billingSubscriptionId: Number(subscriptionId),
        paidThroughDate: saved.next_bill_date,
        collectionMode: remoteMutation?.allowed
          ? 'legacy_stripe_subscription'
          : 'household_ledger',
        remoteCollectorQuarantined: remoteMutation?.quarantined === true,
      },
      stripeObjectId: saved.stripe_subscription_id,
      actorUserId,
      actorType,
    })
    return saved
  })
}
