import { cancelDuplicateMembershipBills } from './membershipTransferPendingBills.js'
import { getStripeClient } from './stripeBilling.js'
import { guardLegacyRemoteSubscriptionMutation } from './remoteSubscriptionMutationGuard.js'
import { recordBillingActivity } from './billingActivity.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { loadCustomerBillingAccount, loadCustomerBillingAnnualMemberships, lifetimeOwnerWaiverAppliesToFamily } from './customerBillingQueries.js'
import { canonicalActiveHouseholdMemberPredicate } from './householdMembership.js'

const memberName = (member) => [member.first_name, member.last_name].filter(Boolean).join(' ')

export async function transferCustomerBillingMembership(pool, {
  familyId, facilityId, memberId, actorUserId, requestKey, input = {}, stripeClient = null,
}) {
  const targetMemberId = Number(input.targetMemberId)
  if (![familyId, facilityId, memberId, targetMemberId].every((id) => Number.isSafeInteger(id) && id > 0)) {
    throw new Error('Choose a valid family member for this membership.')
  }
  if (!actorUserId || !requestKey) throw new Error('An authenticated administrator and Idempotency-Key are required.')
  if (targetMemberId === memberId) throw new Error('Choose a different family member.')
  const account = await loadCustomerBillingAccount(pool, familyId, facilityId)
  if (!account) throw new Error('Billing account not found.')
  return withBillingAccountCollectionLock(pool, account.id, async (db) => {
    await db.query('BEGIN')
    const remoteChanges = []
    let stripe = stripeClient
    try {
      const eventKey = `membership-transfer:${account.id}:${requestKey}`
      const replay = await db.query(
        'SELECT after_value FROM billing_account_activity WHERE event_key = $1', [eventKey],
      )
      if (replay.rows[0]) {
        const saved = replay.rows[0].after_value
        if (saved.previousMemberId !== memberId || saved.memberId !== targetMemberId) {
          throw new Error('This request key was already used for a different membership transfer.')
        }
        await db.query('COMMIT')
        return { ...saved, replayed: true }
      }
      // Lock identities in a stable order as well as the household collector.
      const people = await db.query(
        `SELECT m.id, m.first_name, m.last_name FROM member m
         WHERE m.id = ANY($1::bigint[]) AND m.facility_id = $3
           AND ${canonicalActiveHouseholdMemberPredicate({ memberAlias: 'm', familyIdReference: '$2' })}
         ORDER BY m.id FOR UPDATE OF m`, [[memberId, targetMemberId], familyId, facilityId],
      )
      const source = people.rows.find((row) => Number(row.id) === memberId)
      const target = people.rows.find((row) => Number(row.id) === targetMemberId)
      if (!source || !target) throw new Error('Both members must belong to this billing account’s family.')
      const waivers = await db.query(
        `SELECT config FROM discount_rule WHERE facility_id = $1 AND active = TRUE
         AND config->>'lifetime_owner_waiver' = 'true'`, [facilityId],
      )
      if (waivers.rows.some((rule) => lifetimeOwnerWaiverAppliesToFamily(rule, familyId))) {
        throw new Error('Lifetime family memberships already cover every family member and cannot be transferred.')
      }
      const memberships = await loadCustomerBillingAnnualMemberships(db, {
        accountId: account.id,
        members: people.rows.map((row) => ({ id: Number(row.id), name: memberName(row) })),
      })
      const original = memberships.find((row) => row.memberId === memberId)
      const destination = memberships.find((row) => row.memberId === targetMemberId)
      if (!original?.active) throw new Error('Only a valid annual membership can be transferred.')
      if (destination?.active) {
        throw new Error('The selected family member already has a valid membership.')
      }
      if (input.membershipDate !== original.membershipDate || input.renewalDate !== original.renewalDate) {
        throw new Error('This membership changed. Refresh the account before transferring it.')
      }
      if (input.chargeId != null && Number(input.chargeId) !== original.membershipChargeId) {
        throw new Error('Only the current membership bill can transfer this membership.')
      }
      const subscriptions = await db.query(
        `SELECT * FROM billing_subscription WHERE family_billing_account_id = $1
         AND member_id = ANY($2::bigint[])
         AND (source_type = 'annual_membership' OR pricing_option_key = 'annual_membership')
         ORDER BY id FOR UPDATE`, [account.id, [memberId, targetMemberId]],
      )
      const sourceSubscriptions = subscriptions.rows.filter((row) => Number(row.member_id) === memberId && (row.status !== 'cancelled' || Number(row.id) === original.billingSubscriptionId))
      const priorTargetSubscriptions = subscriptions.rows.filter((row) => Number(row.member_id) === targetMemberId && row.status !== 'cancelled')
      if (priorTargetSubscriptions.some((row) => row.stripe_subscription_id)) {
        throw new Error('Cancel the selected member’s existing renewal subscription before transferring a membership.')
      }
      const transferredAt = new Date().toISOString()
      const transfer = {
        previousMemberId: memberId, previousMemberName: memberName(source),
        memberId: targetMemberId, memberName: memberName(target), transferredAt,
        membershipDate: original.membershipDate, renewalDate: original.renewalDate,
      }
      const cancelledPendingBills = await cancelDuplicateMembershipBills(db, {
        account, sourceMemberId: memberId, targetMemberId,
        membershipDate: original.membershipDate, renewalDate: original.renewalDate,
        actorUserId, eventKey, stripeClient: stripe,
      })
      transfer.cancelledPendingBills = cancelledPendingBills
      // Keep the original redemption as an ended audit record; the recipient gets
      // exactly the same satisfaction date, creation date, and paid-through period.
      const redemptions = await db.query(
        `UPDATE additional_fee_redemption r SET ended_at = now(), end_reason = 'membership_transferred'
         FROM additional_fee f WHERE f.id = r.fee_id AND r.member_id = $1
         AND r.amount_cents >= 0 AND (r.ended_at IS NULL OR r.ended_at > now())
         AND CASE WHEN r.period_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                  THEN r.period_key > to_char(CURRENT_DATE, 'YYYY-MM-DD')
                  ELSE COALESCE(r.satisfied_at, r.created_at) + interval '1 year' > CURRENT_DATE END
         AND (f.trigger_type = 'once_per_year' OR f.apply_basis = 'per_year'
              OR lower(f.name) LIKE '%annual%' OR lower(f.name) LIKE '%membership%')
         RETURNING r.*`, [memberId],
      )
      // Reconciliation updates entitlements by charge ID. Retain ended provenance
      // on the old owner. Release the unique charge link BEFORE inserting the
      // recipient; the transaction restores it if any later step fails.
      await db.query(
        `UPDATE additional_fee_redemption SET billing_charge_id = NULL
         WHERE id = ANY($1::bigint[])`, [redemptions.rows.map((row) => Number(row.id))],
      )
      for (const row of redemptions.rows) {
        const inserted = await db.query(
          `INSERT INTO additional_fee_redemption
             (fee_id, member_id, signup_id, period_key, amount_cents, created_at, satisfied_at, billing_charge_id)
           VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)
           ON CONFLICT (fee_id, member_id, period_key) DO UPDATE
             SET amount_cents = EXCLUDED.amount_cents, created_at = EXCLUDED.created_at,
                 satisfied_at = EXCLUDED.satisfied_at, billing_charge_id = EXCLUDED.billing_charge_id,
                 ended_at = NULL, end_reason = NULL
           WHERE additional_fee_redemption.ended_at IS NOT NULL
           RETURNING id`,
          [row.fee_id, targetMemberId, row.period_key, row.amount_cents, row.created_at, row.satisfied_at, row.billing_charge_id],
        )
        if (!inserted.rows[0]) throw new Error('The recipient already has a membership record for this term. Refresh the account.')
      }
      await db.query(
        `UPDATE billing_subscription SET status = 'cancelled', auto_renewal = FALSE, updated_at = now()
         WHERE id = ANY($1::bigint[])`, [priorTargetSubscriptions.map((row) => Number(row.id))],
      )
      await db.query(
        `UPDATE billing_subscription SET member_id = $2,
           source_id = split_part(source_id, ':', 1) || ':' || $2::bigint::text, updated_at = now()
         WHERE id = ANY($1::bigint[])`, [sourceSubscriptions.map((row) => Number(row.id)), targetMemberId],
      )
      // Move current and posted future terms; amounts, payment allocations, and
      // service dates are preserved. Append provenance for repeated transfers.
      const charges = await db.query(
        `UPDATE billing_charge SET member_id = $2,
           source_id = split_part(source_id, ':', 1) || ':' || $2::bigint::text || ':' || split_part(source_id, ':', 3),
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
             'membershipTransfer', $4::jsonb,
             'membershipTransfers', COALESCE(metadata->'membershipTransfers', '[]'::jsonb) || jsonb_build_array($4::jsonb))
         WHERE family_billing_account_id = $3 AND member_id = $1 AND source_type = 'additional_fee'
           AND source_id ~ '^[0-9]+:[0-9]+:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
           AND split_part(source_id, ':', 3) > to_char(CURRENT_DATE, 'YYYY-MM-DD')
         RETURNING id`, [memberId, targetMemberId, account.id, JSON.stringify(transfer)],
      )
      if (!redemptions.rows.length && original.membershipChargeId) {
        await db.query(
          `INSERT INTO additional_fee_redemption
             (fee_id, member_id, period_key, amount_cents, created_at, satisfied_at, billing_charge_id)
           SELECT split_part(source_id, ':', 1)::bigint, member_id, $3, amount_cents, $4, $4, id
           FROM billing_charge WHERE id = $1 AND member_id = $2
           ON CONFLICT (fee_id, member_id, period_key) DO UPDATE
             SET billing_charge_id = EXCLUDED.billing_charge_id, amount_cents = EXCLUDED.amount_cents,
                 created_at = EXCLUDED.created_at, satisfied_at = EXCLUDED.satisfied_at,
                 ended_at = NULL, end_reason = NULL`,
          [original.membershipChargeId, targetMemberId, original.renewalDate, original.membershipDate],
        )
      }
      await db.query(
        `UPDATE billing_charge SET member_id = $2
         WHERE family_billing_account_id = $3 AND related_charge_id = ANY($1::bigint[])`,
        [charges.rows.map((row) => Number(row.id)), targetMemberId, account.id],
      )
      const previousPricing = await db.query(
        `SELECT * FROM annual_membership_renewal_pricing
         WHERE family_billing_account_id = $1 AND member_id = ANY($2::bigint[]) FOR UPDATE`,
        [account.id, [memberId, targetMemberId]],
      )
      // Existing recipient pricing is superseded only for the transferred fee.
      await db.query(
        `DELETE FROM annual_membership_renewal_pricing target USING annual_membership_renewal_pricing source
         WHERE source.family_billing_account_id = $1 AND source.member_id = $2
         AND target.family_billing_account_id = source.family_billing_account_id
         AND target.member_id = $3 AND target.additional_fee_id = source.additional_fee_id`,
        [account.id, memberId, targetMemberId],
      )
      await db.query(
        `UPDATE annual_membership_renewal_pricing SET member_id = $2, updated_at = now()
         WHERE family_billing_account_id = $3 AND member_id = $1`, [memberId, targetMemberId, account.id],
      )
      await recordBillingActivity(db, {
        eventKey, accountId: account.id, memberId: targetMemberId,
        chargeId: original.membershipChargeId, eventType: 'annual_membership_transferred',
        summary: `Annual membership transferred from ${transfer.previousMemberName} to ${transfer.memberName}. The original membership is no longer valid.`,
        beforeValue: original, afterValue: transfer,
        details: { ...transfer, cancelledPendingBills, renewalPricingBefore: previousPricing.rows, transferredChargeIds: charges.rows.map((row) => Number(row.id)) }, actorUserId,
      })
      for (const subscription of sourceSubscriptions) {
        if (!subscription.stripe_subscription_id || subscription.status === 'cancelled') continue
        const policy = await guardLegacyRemoteSubscriptionMutation(db, {
          accountId: account.id, stripeSubscriptionId: subscription.stripe_subscription_id,
          operation: 'annual-membership-transfer',
        })
        if (!policy.allowed) continue
        stripe ??= await getStripeClient()
        if (!stripe) throw new Error('Stripe is unavailable. The membership has not been transferred.')
        const remote = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
        if (String(remote.customer?.id ?? remote.customer) !== String(account.stripe_customer_id)
          || Number(remote.metadata?.memberId) !== memberId
          || Number(remote.metadata?.familyBillingAccountId) !== Number(account.id)) {
          throw new Error('The Stripe membership owner could not be verified. The membership has not been transferred.')
        }
        // Metadata-only update preserves the Stripe billing anchor and price.
        remoteChanges.push({ id: remote.id, memberId: String(memberId) })
        await stripe.subscriptions.update(remote.id, { metadata: { memberId: String(targetMemberId) } })
      }
      await db.query('COMMIT')
      return { ...transfer, replayed: false }
    } catch (error) {
      await db.query('ROLLBACK')
      for (const remote of remoteChanges.reverse()) {
        try {
          await stripe.subscriptions.update(remote.id, { metadata: { memberId: remote.memberId } })
        } catch (restoreError) {
          console.error('[membership-transfer] Stripe ownership restoration failed:', remote.id, restoreError.message)
          error.message = 'Membership transfer failed and Stripe ownership needs reconciliation before another transfer.'
        }
      }
      throw error
    }
  })
}
