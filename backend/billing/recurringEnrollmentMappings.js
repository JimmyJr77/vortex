import { resolveFamilyEnrollmentPricing } from './familyEnrollmentPricing.js'
import { billingDateString, nextBillingMonth } from './canonicalBillingMigrationState.js'

/** Recover local recurrence from enrollment, independently of cards/Stripe.
 * Never creates a bill or payment. Explicit one-time/pass purchases are excluded
 * by the authoritative recurring enrollment pricing resolver. */
export async function ensureRecurringEnrollmentMappings(db, {
  accountId, billingMonth, pricingResolver = resolveFamilyEnrollmentPricing,
} = {}) {
  const account=(await db.query('SELECT id,family_id FROM family_billing_account WHERE id=$1',[accountId])).rows[0]
  if(!account)throw new Error('A family billing account is required for recurring enrollment.')
  const pricing=await pricingResolver(db,{familyId:account.family_id,periodKey:billingMonth.slice(0,7),ensureSchema:false,strictPricing:true})
  const created=[]
  for(const line of pricing.lines){
    if(line.subscriptionId!=null)continue
    const signup=(await db.query(`SELECT id,member_id,enrollment_start_date,created_at FROM scheduling_signup
      WHERE id=$1 AND status='confirmed'`,[line.signupId])).rows[0]
    if(!signup)continue
    const start=billingDateString(signup.enrollment_start_date??signup.created_at)
    if(!start)throw new Error('Enrollment start is required for recurring setup.')
    const inserted=await db.query(`INSERT INTO billing_subscription
      (family_billing_account_id,member_id,source_type,source_id,description,monthly_amount_cents,
       discount_amount_cents,net_monthly_cents,status,start_date,anchor_day,next_bill_date)
      SELECT $1,signup.member_id,'scheduling_signup',signup.id::text,form.title,$3,$4,$5,'active',$6::date,1,$7::date
      FROM scheduling_signup signup JOIN scheduling_form form ON form.id=signup.form_id
      JOIN member ON member.id=signup.member_id
      WHERE signup.id=$2 AND signup.status='confirmed' AND member.family_id=$8
      ON CONFLICT (source_type,source_id) WHERE source_id IS NOT NULL AND status <> 'cancelled' DO NOTHING
      RETURNING id`,[accountId,signup.id,line.grossCents,line.discountCents,line.netCents,start,nextBillingMonth(`${start.slice(0,7)}-01`),account.family_id])
    if(inserted.rows[0]){
      created.push(Number(inserted.rows[0].id))
      await db.query(`INSERT INTO stripe_billing_alert
        (stripe_event_id,family_billing_account_id,alert_type,severity,message,details)
        VALUES ($1,$2,'enrollment_initial_bill_review','warning',$3,$4::jsonb)
        ON CONFLICT (stripe_event_id) DO UPDATE SET details=EXCLUDED.details,
          resolved_at=NULL,action_status='open',updated_at=now()`,
      [`enrollment-initial-review:${signup.id}`,accountId,
        'Recurring enrollment restored. Verify its initial-period bill before collecting.',
        JSON.stringify({signupId:Number(signup.id),subscriptionId:Number(inserted.rows[0].id),startDate:start})])
    }
  }
  return {createdSubscriptionIds:created}
}
