import { randomUUID } from 'node:crypto'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { resolveFamilyEnrollmentPricing } from './familyEnrollmentPricing.js'
import { billingDateString, facilityDate } from './canonicalBillingMigrationState.js'
import { loadCalendarRowsForSlotGroups } from '../scheduling/freePassEngine.js'
import { prorationForLine } from '../scheduling/firstMonthProration.js'
import { recordBillingActivity } from './billingActivity.js'

export function currentEnrollmentChargeValues(line, proration = null) {
  const ratio = proration?.classStartsFutureMonth ? 1 : (proration?.ratio ?? 1)
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) throw new Error('Invalid enrollment proration.')
  const gross = Math.round(line.grossCents * ratio)
  const net = Math.round(line.netCents * ratio)
  const discount = gross - net
  if (![gross, net, discount].every(Number.isSafeInteger)) throw new Error('Invalid enrollment price.')
  const annotations = []
  if (ratio < 1) annotations.push({ kind: 'proration',
    label: `Proration (${proration.remainingClasses} of ${proration.classesPerMonth ?? 4} classes)`,
    amountCents: -(line.grossCents - gross) })
  if (discount !== 0) annotations.push({ kind: 'automatic', label: 'Automatic discount', amountCents: -discount })
  return { gross, net, discount, annotations }
}

/** Reprice this month's uncollected tuition after household enrollment changes.
 * Collection snapshots, payment history and explicit adjustments stay immutable. */
export async function reconcileCurrentEnrollmentCharges(pool, { familyId, now = new Date(), apply = true,
  pricingResolver = resolveFamilyEnrollmentPricing, calendarLoader = loadCalendarRowsForSlotGroups } = {}) {
  const accounts = (await pool.query(`SELECT a.id, f.timezone FROM family_billing_account a
    JOIN family ON family.id=a.family_id JOIN facility f ON f.id=family.facility_id
    WHERE a.family_id=$1 AND a.is_active=TRUE`, [familyId])).rows
  const changes = []
  for (const account of accounts) await withBillingAccountCollectionLock(pool, account.id, async db => {
    const periodKey = facilityDate(now, account.timezone).slice(0, 7)
    await db.query('BEGIN')
    try {
      // Match the lifecycle lock order used by recurring charge reconciliation.
      await db.query(`SELECT s.id FROM scheduling_signup s JOIN member m ON m.id=s.member_id
        WHERE m.family_id=$1 ORDER BY s.id FOR UPDATE OF s`, [familyId])
      const pricing = await pricingResolver(db, { familyId: Number(familyId), periodKey,
        ensureSchema: false, strictPricing: true })
      const charges = (await db.query(`SELECT c.*, s.slot_group_id, s.time_slot_id,
          s.enrollment_start_date, s.pricing_breakdown, s.created_at AS signup_created_at
        FROM billing_charge c JOIN billing_subscription bs ON bs.id=c.subscription_id
        JOIN scheduling_signup s ON bs.source_type='scheduling_signup' AND bs.source_id=s.id::text
        WHERE c.family_billing_account_id=$1 AND c.charge_type='recurring'
          AND c.source_type IN ('scheduling_signup','billing_subscription')
          AND to_char(c.service_period_start,'YYYY-MM')=$2
          AND s.status='confirmed' AND s.orphaned_at IS NULL
        ORDER BY c.id FOR UPDATE OF c`, [account.id, periodKey])).rows
      const calendars = await calendarLoader(db, [...new Set(charges.map(c => Number(c.slot_group_id)))])
      for (const charge of charges) {
        const line = pricing.lines.find(l => Number(l.subscriptionId) === Number(charge.subscription_id))
        if (!line || charge.price_adjustment_id || line.priceAdjustmentId
          || charge.metadata?.classMoveFromSignupId || charge.metadata?.classTransfer
          || (charge.pricing_breakdown?.line?.applied ?? []).some(a => a.kind === 'free'
            || a.freeDurationMonths || a.freeDurationWeeks)) continue
        const protectedCharge = (await db.query(`SELECT
          EXISTS(SELECT 1 FROM billing_payment_application WHERE billing_charge_id=$1)
          OR EXISTS(SELECT 1 FROM billing_monthly_invoice_line WHERE billing_charge_id=$1)
          OR EXISTS(SELECT 1 FROM billing_statement_line WHERE charge_id=$1)
          OR EXISTS(SELECT 1 FROM billing_payment_attempt a LEFT JOIN billing_payment_attempt_charge r
            ON r.billing_payment_attempt_id=a.id WHERE a.target_charge_id=$1 OR r.billing_charge_id=$1)
          OR EXISTS(SELECT 1 FROM billing_charge WHERE related_charge_id=$1)
          AS protected`, [charge.id])).rows[0]?.protected
        const collectionProtected = protectedCharge || charge.stripe_checkout_session_id || charge.stripe_payment_intent_id
          || charge.stripe_invoice_item_id || !['none','unpaid'].includes(charge.collection_status)
        let proration = null
        if (charge.source_type === 'scheduling_signup') {
          const start = billingDateString(charge.enrollment_start_date ?? charge.signup_created_at)
          if (start?.slice(0,7) !== periodKey) continue
          const rows = calendars.get(Number(charge.slot_group_id)) ?? []
          if (!rows.length) throw new Error(`Enrollment charge ${charge.id} has no calendar for proration.`)
          proration = prorationForLine(rows, {
            slotGroupId: Number(charge.slot_group_id), timeSlotId: Number(charge.time_slot_id) || null, fromDate: start })
        }
        const next = currentEnrollmentChargeValues(line, proration)
        const sameAmounts = Number(charge.amount_cents) === next.net && Number(charge.gross_amount_cents) === next.gross
          && Number(charge.discount_amount_cents) === next.discount
        // Display-only details may be filled in when every financial amount is
        // already exact, including a bill reserved by an open Checkout link.
        if (collectionProtected && !sameAmounts) continue
        if (sameAmounts && JSON.stringify(charge.metadata?.discountAnnotations) === JSON.stringify(next.annotations)) continue
        if (!apply) {
          changes.push({chargeId:Number(charge.id),beforeAmountCents:Number(charge.amount_cents),amountCents:next.net,
            discountAnnotations:next.annotations})
          continue
        }
        await db.query(`UPDATE billing_charge SET amount_cents=$2,gross_amount_cents=$3,discount_amount_cents=$4,
          metadata=COALESCE(metadata,'{}'::jsonb)||$5::jsonb WHERE id=$1`,
        [charge.id,next.net,next.gross,next.discount,JSON.stringify({discountAnnotations:next.annotations,
          enrollmentRepricing:{periodKey,monthlyGrossCents:line.grossCents,monthlyNetCents:line.netCents,ratio:proration?.ratio??1}})])
        await recordBillingActivity(db,{eventKey:`enrollment-reprice:${charge.id}:${randomUUID()}`,
          accountId:Number(account.id),chargeId:Number(charge.id),actorType:'system',
          eventType:'enrollment_charge_repriced',summary:sameAmounts ? 'Tuition proration and discount details refreshed.'
            : 'Unpaid tuition recalculated after household enrollment pricing changed.',
          beforeValue:{amountCents:Number(charge.amount_cents),grossAmountCents:Number(charge.gross_amount_cents),discountAmountCents:Number(charge.discount_amount_cents)},
          afterValue:{amountCents:next.net,grossAmountCents:next.gross,discountAmountCents:next.discount},
          details:{periodKey,discountAnnotations:next.annotations}})
        changes.push({chargeId:Number(charge.id),amountCents:next.net})
      }
      await db.query('COMMIT')
    } catch(error) { await db.query('ROLLBACK'); throw error }
  })
  return { changes }
}
