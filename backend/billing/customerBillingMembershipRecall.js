import { loadCustomerBillingAccount } from './customerBillingQueries.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { cancelUnpaidMembershipBills } from './membershipTransferPendingBills.js'
import { recordBillingActivity } from './billingActivity.js'

export async function recallCustomerBillingMembershipBill(pool, {
  familyId, facilityId, chargeId, actorUserId, requestKey, stripeClient = null,
}) {
  if (![familyId, facilityId, chargeId].every((id) => Number.isSafeInteger(id) && id > 0)
    || !actorUserId || !requestKey) throw new Error('A valid bill, administrator, and Idempotency-Key are required.')
  const account = await loadCustomerBillingAccount(pool, familyId, facilityId)
  if (!account) throw new Error('Billing account not found.')
  return withBillingAccountCollectionLock(pool, account.id, async (db) => {
    await db.query('BEGIN')
    try {
      const eventKey = `membership-bill-recall:${account.id}:${requestKey}`
      const replay = await db.query('SELECT after_value FROM billing_account_activity WHERE event_key = $1', [eventKey])
      if (replay.rows[0]) {
        if (replay.rows[0].after_value.chargeId !== chargeId) throw new Error('This request key was used for a different bill.')
        await db.query('COMMIT')
        return { ...replay.rows[0].after_value, replayed: true }
      }
      const result = await db.query(
        `SELECT charge.*,
          COALESCE((SELECT SUM(a.amount_cents) FROM billing_charge a WHERE a.related_charge_id = charge.id
            AND a.source_type IN ('charge_adjustment', 'refund_offset')), 0)::int AS adjustment_cents
         FROM billing_charge charge
         JOIN additional_fee fee ON fee.id::text = split_part(charge.source_id, ':', 1)
         WHERE charge.id = $1 AND charge.family_billing_account_id = $2
           AND charge.source_type = 'additional_fee'
           AND charge.source_id ~ '^[0-9]+:[0-9]+:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
           AND (fee.trigger_type = 'once_per_year' OR fee.apply_basis = 'per_year')
         FOR UPDATE OF charge`, [chargeId, account.id],
      )
      const charge = result.rows[0]
      if (!charge) throw new Error('An unpaid annual membership bill was not found. Refresh the account.')
      const [data] = await cancelUnpaidMembershipBills(db, {
        account, candidates: [charge], targetMemberId: Number(charge.member_id),
        actorUserId, eventKey, stripeClient, recall: true,
      })
      await recordBillingActivity(db, {
        eventKey, accountId: account.id, memberId: Number(charge.member_id), chargeId,
        eventType: 'annual_membership_bill_recalled', summary: 'Unpaid annual membership bill recalled.',
        afterValue: data, details: data, actorUserId,
      })
      await db.query('COMMIT')
      return data
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }
  })
}
