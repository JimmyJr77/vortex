import { billingHouseholdAutoActivateEnabled } from './billingFeatureFlags.js'
import { activateEnrollmentHouseholdBilling } from './enrollmentAutoBilling.js'
import { getStripeClient } from './stripeBilling.js'
import { syncFamilyEnrollmentDiscounts } from '../scheduling/pauseEnrollmentBilling.js'

/** Complete collection setup after either enrollment or a separately paid
 * membership. This does not initiate a new payment. Failed setup stays visible
 * and can safely retry when the membership webhook is redelivered. */
export async function completeHouseholdEnrollmentSetup(pool, { memberId, environment = process.env,
  stripeClient, activate = activateEnrollmentHouseholdBilling, syncDiscounts = syncFamilyEnrollmentDiscounts } = {}) {
  if (!billingHouseholdAutoActivateEnabled(environment)) return { status: 'feature_disabled' }
  const account = (await pool.query(`SELECT a.id, a.family_id FROM member m
    JOIN family_billing_account a ON a.family_id=m.family_id AND a.is_active=TRUE
    WHERE m.id=$1 AND EXISTS (SELECT 1 FROM scheduling_signup s
      WHERE s.member_id=m.id AND s.status='confirmed' AND s.orphaned_at IS NULL)`, [memberId])).rows[0]
  if (!account) return { status: 'no_enrollment' }
  const key = `enrollment-setup:${account.id}`
  try {
    await syncDiscounts(pool, Number(account.family_id))
    const stripe = stripeClient === undefined ? await getStripeClient() : stripeClient
    const result = await activate(pool, { accountId: Number(account.id), stripe, environment })
    if (result.status !== 'ready' && result.status !== 'feature_disabled') throw new Error(result.status)
    if (result.status === 'ready') await pool.query(`UPDATE stripe_billing_alert SET resolved_at=now(),
      action_status='resolved',updated_at=now(),resolution_note='Household enrollment collection setup completed.'
      WHERE stripe_event_id=$1 AND family_billing_account_id=$2 AND resolved_at IS NULL`, [key,account.id])
    return result
  } catch(error) {
    await pool.query(`INSERT INTO stripe_billing_alert
      (stripe_event_id,family_billing_account_id,alert_type,severity,message,details)
      VALUES ($1,$2,'enrollment_automatic_billing','critical',$3,$4::jsonb)
      ON CONFLICT (stripe_event_id) DO UPDATE SET message=EXCLUDED.message,details=EXCLUDED.details,
        action_status='open',resolved_at=NULL,updated_at=now()`,
    [key,account.id,`Enrollment billing setup needs attention: ${error.message}`,
      JSON.stringify({memberId,stage:'household_setup',reason:error.message})])
    return {status:'setup_pending',reason:error.message}
  }
}
