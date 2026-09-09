import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { allocateHouseholdPaymentsLocked } from './paymentAllocation.js'
import { recordBillingActivity } from './billingActivity.js'

// Visibility alone is not accounting evidence. Only an explicit, unique
// reversal of exactly the same value can automatically retire a correction.
export function correctionPairs(charges) {
  const pairs = []
  const used = new Set()
  for (const reversal of charges) {
    const original = charges.find((row) => String(row.id) === String(reversal.metadata?.reversesChargeId))
    if (!original || original.id === reversal.id
      || String(reversal.related_charge_id) !== String(original.id)
      || !String(reversal.source_type).endsWith('_reversal')
      || original.metadata?.reversesChargeId != null
      || charges.some((row) => String(row.metadata?.reversesChargeId) === String(reversal.id))
      || !Number(original.amount_cents)
      || Number(original.amount_cents) + Number(reversal.amount_cents) !== 0
      || original.metadata?.customerAuditVisibility !== 'suppressed'
      || reversal.metadata?.customerAuditVisibility !== 'suppressed'
      || charges.filter((row) => String(row.metadata?.reversesChargeId) === String(original.id)).length !== 1
      || used.has(String(original.id)) || used.has(String(reversal.id))) continue
    pairs.push([original, reversal])
    used.add(String(original.id))
    used.add(String(reversal.id))
  }
  return pairs
}

export async function reassessBillingAllocations(pool, { accountId, actorUserId = null }) {
  return withBillingAccountCollectionLock(pool, accountId, async (db) => {
    await db.query('BEGIN')
    try {
      await db.query('SELECT pg_advisory_xact_lock($1)', [Number(accountId)])
      const busy = (await db.query(`SELECT 1 FROM billing_monthly_invoice
        WHERE family_billing_account_id=$1 AND status IN ('draft','open','failed','payment_method_required')
        UNION ALL SELECT 1 FROM billing_payment_attempt WHERE family_billing_account_id=$1
          AND (status IN ('pending','processing','reconciliation_required') OR (status='reserved' AND expires_at>now()))
        UNION ALL SELECT 1 FROM billing_payment WHERE family_billing_account_id=$1
          AND external_status='reconciliation_required'
        UNION ALL SELECT 1 FROM billing_refund WHERE family_billing_account_id=$1
          AND external_status IN ('pending','processing','reconciliation_required') LIMIT 1`, [accountId])).rows.length > 0
      if (busy) {
        await db.query('COMMIT')
        return { corrected: false, message: 'Account refreshed. Payment reconciliation is waiting for an active collection to finish.' }
      }
      const charges = (await db.query('SELECT * FROM billing_charge WHERE family_billing_account_id=$1 FOR UPDATE', [accountId])).rows
      const pairs = correctionPairs(charges)
      const ids = pairs.flat().filter((row) => row.metadata?.allocationRetired !== true).map((row) => row.id)
      // Retiring these entries changes eligibility only; the immutable charge
      // amounts still cancel each other in the account ledger.
      if (ids.length) await db.query(`UPDATE billing_charge SET metadata=COALESCE(metadata,'{}'::jsonb)
        || '{"allocationRetired":true}'::jsonb WHERE family_billing_account_id=$1 AND id=ANY($2::bigint[])`, [accountId, ids])
      const result = await allocateHouseholdPaymentsLocked(db, {
        accountId, actorType: 'admin', manageTransaction: false,
        restoreMembershipCredits: false, updateEntitlements: false,
      })
      if (result.blocked) {
        await db.query('ROLLBACK')
        return { corrected: false, message: 'Account refreshed. A checkout needs reconciliation before allocations can be reassessed.' }
      }
      const corrected = ids.length > 0 || result.applications.length > 0 || result.releasedApplications.length > 0
      const unresolved = charges.some((row) => row.metadata?.customerAuditVisibility === 'suppressed'
        && row.metadata?.allocationRetired !== true && !pairs.flat().includes(row))
      if (corrected) await recordBillingActivity(db, {
        accountId, actorUserId, actorType: 'admin', eventType: 'billing_allocations_reassessed',
        summary: 'Refresh reassessed existing payment allocations. No bills, payments, or refunds were created.',
        details: { retiredChargeIds: ids, applicationIds: result.applications.map((row) => row.id), releasedApplications: result.releasedApplications },
      })
      await db.query('COMMIT')
      return { corrected, message: (corrected ? 'Account refreshed. Payment allocations corrected.' : 'Account refreshed. Payment allocations verified.')
        + (unresolved ? ' Some historical corrections need administrative review.' : '') }
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }
  })
}
