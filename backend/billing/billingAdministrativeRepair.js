import { resolveFamilyEnrollmentPricing } from './familyEnrollmentPricing.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { allocateHouseholdPaymentsLocked } from './paymentAllocation.js'
import { recordBillingActivity } from './billingActivity.js'
import { billingDateString, nextBillingMonth } from './canonicalBillingMigrationState.js'

/** Administrative repair only. No bill creation, collection or refund API is
 * called here. Price/member corrections and payment allocation preserve money. */
export async function repairBillingAdministration(pool, {
  accountId, billingMonth, apply = false, confirmedRemoteRefunds = [], reviewedCorrectionChargeIds = [],
  pricingResolver = resolveFamilyEnrollmentPricing,
} = {}) {
  const run = async (rawDb) => {
    const db = { query(sql, params) {
      const text = String(sql)
      if (/INSERT\s+INTO\s+(billing_charge|billing_payment|billing_refund|billing_monthly_invoice|billing_payment_attempt)\b/i.test(text)
        || /UPDATE\s+billing_charge\s+SET[\s\S]*?(?:SET|,)\s*(?:amount_cents|gross_amount_cents|discount_amount_cents)\s*=/i.test(text)
        || /UPDATE\s+billing_charge\s+SET\s*(?:amount_cents|gross_amount_cents|discount_amount_cents)\s*=/i.test(text)) {
        throw new Error('Administrative repair cannot create bills, payments or refunds, or change charge amounts.')
      }
      return rawDb.query(sql, params)
    } }
    if (apply) await db.query('BEGIN')
    try {
      const account = (await db.query('SELECT id, family_id FROM family_billing_account WHERE id = $1', [accountId])).rows[0]
      if (!account) throw new Error('Billing account was not found.')
      const pricing = await pricingResolver(db, { familyId: account.family_id,
        periodKey: billingMonth.slice(0, 7), ensureSchema: false, strictPricing: true })
      const subscriptions = (await db.query('SELECT * FROM billing_subscription WHERE family_billing_account_id = $1', [accountId])).rows
      const charges = (await db.query('SELECT * FROM billing_charge WHERE family_billing_account_id = $1', [accountId])).rows
      const plan = { accountId: Number(accountId), billingMonth, changes: [], blocked: [] }
      for (const line of pricing.lines) {
        const source = (await db.query(`SELECT signup.id, signup.member_id, signup.status,
          signup.enrollment_start_date, signup.created_at, form.title
          FROM scheduling_signup signup LEFT JOIN scheduling_form form ON form.id = signup.form_id
          WHERE signup.id = $1`, [line.signupId])).rows[0]
        const existing = subscriptions.filter((row) => row.source_type === 'scheduling_signup'
          && String(row.source_id) === String(line.signupId) && row.status !== 'cancelled')
        if (!source || source.status !== 'confirmed' || existing.length > 1) {
          plan.blocked.push({ signupId: line.signupId, reason: 'Enrollment mapping is ambiguous or not confirmed.' }); continue
        }
        const subscription = existing[0]
        if (subscription?.stripe_subscription_id) {
          plan.blocked.push({ signupId: line.signupId, reason: 'Legacy Stripe ownership requires separate review.' }); continue
        }
        if (!subscription) {
          const start = billingDateString(source.enrollment_start_date ?? source.created_at)
          if (!start) throw new Error('Enrollment start is required for subscription recovery.')
          const change = { kind: 'restore_subscription', signupId: line.signupId, memberId: Number(source.member_id),
            grossCents: line.grossCents, discountCents: line.discountCents, netCents: line.netCents,
            startDate: start, nextBillDate: nextBillingMonth(`${start.slice(0, 7)}-01`),
            initialChargeRequiresReview: true }
          plan.changes.push(change)
          if (apply) await db.query(`INSERT INTO billing_subscription
            (family_billing_account_id, member_id, source_type, source_id, description,
             monthly_amount_cents, discount_amount_cents, net_monthly_cents,
             status, start_date, anchor_day, next_bill_date)
            VALUES ($1,$2,'scheduling_signup',$3,$4,$5,$6,$7,'active',$8::date,1,$9::date)
            ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL AND status <> 'cancelled' DO NOTHING`,
          [accountId, source.member_id, String(source.id), source.title, line.grossCents,
            line.discountCents, line.netCents, start, change.nextBillDate])
          continue
        }
        if (Number(subscription.member_id) !== Number(source.member_id)
          || Number(subscription.monthly_amount_cents) !== line.grossCents
          || Number(subscription.discount_amount_cents) !== line.discountCents
          || Number(subscription.net_monthly_cents) !== line.netCents) {
          plan.changes.push({ kind: 'subscription_identity_or_pricing', subscriptionId: Number(subscription.id),
            memberId: Number(source.member_id), grossCents: line.grossCents,
            discountCents: line.discountCents, netCents: line.netCents })
          if (apply) await db.query(`UPDATE billing_subscription SET member_id=$2, monthly_amount_cents=$3,
            discount_amount_cents=$4, net_monthly_cents=$5, updated_at=now() WHERE id=$1`,
          [subscription.id, source.member_id, line.grossCents, line.discountCents, line.netCents])
        }
        for (const charge of charges.filter((c) => Number(c.subscription_id) === Number(subscription.id)
          && Number(c.member_id) !== Number(source.member_id))) {
          // The enrollment reassignment audit establishes historical intent.
          const reassigned = (await db.query(`SELECT 1 FROM billing_account_activity
            WHERE family_billing_account_id=$1 AND signup_id=$2 AND event_type='enrollment_member_reassigned'
              AND after_value->>'memberId'=$3 ORDER BY id DESC LIMIT 1`,
          [accountId, source.id, String(source.member_id)])).rows.length > 0
          if (!reassigned) { plan.blocked.push({ chargeId: Number(charge.id), reason: 'Historical member reassignment evidence is missing.' }); continue }
          plan.changes.push({ kind: 'charge_member_assignment', chargeId: Number(charge.id),
            previousMemberId: Number(charge.member_id), memberId: Number(source.member_id) })
          if (apply) await db.query('UPDATE billing_charge SET member_id=$2 WHERE id=$1', [charge.id, source.member_id])
        }
      }
      const reviewedIds = new Set(reviewedCorrectionChargeIds.map(Number))
      const hidden = charges.filter((c) => reviewedIds.has(Number(c.id)) && c.metadata?.customerAuditVisibility === 'suppressed')
      if (hidden.length !== reviewedIds.size) throw new Error('Every reviewed correction must belong to this account and be suppressed.')
      const retire = hidden.filter((c) => c.metadata?.allocationRetired !== true)
      if (retire.length && hidden.reduce((n,c) => n + Number(c.amount_cents), 0) === 0) {
        const ids = hidden.map((c) => Number(c.id))
        const reserved = (await db.query(`SELECT 1 FROM billing_monthly_invoice_line line
          JOIN billing_monthly_invoice invoice ON invoice.id=line.billing_monthly_invoice_id
          WHERE line.billing_charge_id=ANY($1::bigint[]) AND invoice.status IN ('draft','open','failed','payment_method_required')
          UNION ALL SELECT 1 FROM billing_payment_attempt attempt
          LEFT JOIN billing_payment_attempt_charge reservation ON reservation.billing_payment_attempt_id=attempt.id
          WHERE (reservation.billing_charge_id=ANY($1::bigint[]) OR attempt.target_charge_id=ANY($1::bigint[]))
            AND (attempt.status IN ('pending','processing','reconciliation_required')
              OR (attempt.status='reserved' AND attempt.expires_at>now())) LIMIT 1`, [ids])).rows.length > 0
        if (reserved) plan.blocked.push({ reason: 'Zero-net corrections are reserved by a collection attempt.' })
        else {
          plan.changes.push({ kind: 'retire_zero_net_corrections_from_allocation', chargeIds: ids, netCents: 0 })
          if (apply) await db.query(`UPDATE billing_charge SET metadata=COALESCE(metadata,'{}'::jsonb)
            || '{"allocationRetired":true}'::jsonb WHERE id=ANY($1::bigint[])`, [ids])
        }
      }
      for (const remote of confirmedRemoteRefunds) {
        const refund = (await db.query(`SELECT refund.*, payment.stripe_payment_intent_id
          FROM billing_refund refund JOIN billing_payment payment ON payment.id=refund.payment_id
          WHERE refund.family_billing_account_id=$1 AND refund.stripe_refund_id=$2`, [accountId, remote.id])).rows[0]
        if (!refund || refund.external_status === 'succeeded') continue
        if (remote.status !== 'succeeded' || Number(remote.amount) !== Number(refund.amount_cents)
          || remote.payment_intent !== refund.stripe_payment_intent_id || refund.ledger_treatment !== 'return_overpayment'
          || !String(refund.error_message).startsWith(`[stripe-refund-ledger-finalization-pending:${remote.id}]`)) {
          plan.blocked.push({ refundId: Number(refund.id), reason: 'Exact completed overpayment refund evidence is required.' }); continue
        }
        plan.changes.push({ kind: 'recognize_already_completed_refund', refundId: Number(refund.id), amountCents: remote.amount })
        if (apply) {
          await db.query(`UPDATE billing_refund SET external_status='succeeded',error_message=NULL,updated_at=now() WHERE id=$1`, [refund.id])
          await db.query(`UPDATE stripe_billing_alert SET resolved_at=COALESCE(resolved_at,now()),
            action_status='resolved', resolution_note='Exact succeeded Stripe refund verified; local ledger finalization repaired without another refund.',updated_at=now()
            WHERE family_billing_account_id=$1 AND stripe_object_id=$2
              AND alert_type='stripe_refund_reconciliation_failed' AND action_status <> 'suspended'`, [accountId,remote.id])
        }
      }
      if (apply) {
        // No promo-credit creation: this path must not bill or refund anyone.
        plan.allocation = await allocateHouseholdPaymentsLocked(db, {
          accountId, actorType: 'system', manageTransaction: false, restoreMembershipCredits: false,
        })
        if (plan.changes.length) await recordBillingActivity(db, { accountId,
          eventType: 'billing_administration_repaired', summary: 'Reconciled billing administration without creating a bill, collecting payment, or issuing a refund.',
          details: plan, actorType: 'system' })
        await db.query('COMMIT')
      }
      return plan
    } catch (error) {
      if (apply) await db.query('ROLLBACK')
      throw error
    }
  }
  return apply ? withBillingAccountCollectionLock(pool, accountId, run) : run(pool)
}
