import { createHash } from 'node:crypto'
import { loadEnrollmentPriceContext, loadPeriodInputs } from './customerBillingAdjustments.js'
import { priceRecurringPeriod } from './recurringPeriodPricing.js'
import { loadCalendarRowsForSlotGroups } from '../scheduling/freePassEngine.js'
import { remainingOccurrencesInMonth, monthBounds, firstOfNextMonth } from '../scheduling/firstMonthProration.js'
import { activeLedgerChargePredicate } from './billingLedgerSql.js'
import { recordBillingActivity } from './billingActivity.js'
import { allocateHouseholdPaymentsLocked } from './paymentAllocation.js'
import { findEnrollmentCheckoutCreationConflict } from './stripeEnrollmentCheckout.js'
import { findActivePurchaseCheckoutOwner } from './purchaseCheckoutAdmission.js'

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const dateOnly = value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10)
export function normalizeStartDateAdjustment(input = {}) {
  const date = String(input.firstBillingDate ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10) !== date) throw new Error('Enter a valid first billing date.')
  const reason = String(input.reason ?? '').trim()
  if (!reason) throw new Error('An administrative reason is required.')
  return { firstBillingDate: date, reason }
}

/** Use the same four-session monthly basis as enrollment checkout. */
export function startDateTuitionForMonth({ periodKey, firstBillingDate, monthlyCents, calendarRows, slotGroupId, timeSlotId }) {
  if (periodKey < firstBillingDate.slice(0,7)) return { amountCents: 0, remainingClasses: 0, ratio: 0 }
  if (periodKey > firstBillingDate.slice(0,7)) return { amountCents: monthlyCents, remainingClasses: null, ratio: 1 }
  if (!calendarRows.length || calendarRows.some(row => row.sg_dates_tbd)) throw new Error('A dated class schedule is required to calculate proration.')
  const remainingClasses = remainingOccurrencesInMonth(calendarRows, { slotGroupId, timeSlotId, fromDate: firstBillingDate })
  const ratio = Math.min(remainingClasses, 4) / 4
  return { amountCents: Math.round(monthlyCents * ratio), remainingClasses, ratio }
}

export async function previewEnrollmentStartDateAdjustment(db, { signupId, facilityId, input,
  pricingResolver = priceRecurringPeriod }) {
  const request = normalizeStartDateAdjustment(input)
  const context = await loadEnrollmentPriceContext(db, signupId, facilityId)
  if (context.signup_status !== 'confirmed') throw new Error('Only a confirmed recurring enrollment can have its first billing date adjusted.')
  const oldDate = dateOnly(context.enrollment_start_date || context.subscription_start_date)
  if (!oldDate) throw new Error('The original enrollment start date is missing.')
  const firstMonth = [oldDate, request.firstBillingDate].sort()[0].slice(0,7)
  const lastMonth = [oldDate, request.firstBillingDate].sort()[1].slice(0,7)
  const periodKeys = []
  for (let month = firstMonth; month <= lastMonth; month = firstOfNextMonth(`${month}-01`).slice(0,7)) {
    if (periodKeys.length >= 120) throw new Error('The start-date correction cannot span more than ten years.')
    periodKeys.push(month)
  }
  const groups = await loadCalendarRowsForSlotGroups(db, [Number(context.slot_group_id)])
  const calendarRows = groups.get(Number(context.slot_group_id)) ?? []
  const inputs = await loadPeriodInputs(db, context)
  const subscriptions = inputs.subscriptions.map(row => Number(row.id) === Number(context.billing_subscription_id)
    ? { ...row, start_date: `${firstMonth}-01` } : row)
  const roots = (await db.query(`SELECT c.*, to_char(COALESCE(c.service_period_start,c.created_at::date),'YYYY-MM') AS period_key,
      COALESCE((SELECT SUM(a.amount_cents) FROM billing_charge a WHERE a.related_charge_id=c.id AND ${activeLedgerChargePredicate('a')}),0)::int AS linked_cents,
      EXISTS(SELECT 1 FROM billing_charge a WHERE a.related_charge_id=c.id AND a.source_type='refund_offset') AS refunded
    FROM billing_charge c WHERE c.family_billing_account_id=$1 AND ${activeLedgerChargePredicate('c')}
      AND c.related_charge_id IS NULL AND c.amount_cents>=0
      AND (c.subscription_id=$2 OR (c.source_type='scheduling_signup' AND c.source_id=$3))
      AND c.source_type IN ('scheduling_signup','billing_subscription')
      AND to_char(COALESCE(c.service_period_start,c.created_at::date),'YYYY-MM') BETWEEN $4 AND $5
    ORDER BY c.id`, [context.family_billing_account_id,context.billing_subscription_id,String(signupId),firstMonth,lastMonth])).rows
  const months = []
  for (const periodKey of periodKeys) {
    const posted = roots.filter(row => row.period_key === periodKey)
    if (posted.some(row => row.refunded)) throw new Error('A refunded tuition bill needs billing review before changing its service dates.')
    if (posted.length > 1) throw new Error(`Multiple original tuition bills exist for ${periodKey}; reconcile them before changing the start date.`)
    const pricing = await pricingResolver(db, { familyId: context.family_id, subscriptions, charges: [], periodKey, strictPricing: true })
    const line = pricing.lines.find(row => Number(row.subscriptionId) === Number(context.billing_subscription_id))
    if (!line) throw new Error(`Tuition could not be priced for ${periodKey}.`)
    const monthlyCents = Number(line.netCents)
    const tuition = startDateTuitionForMonth({ periodKey, firstBillingDate: request.firstBillingDate, monthlyCents, calendarRows,
      slotGroupId: Number(context.slot_group_id), timeSlotId: context.time_slot_id == null ? null : Number(context.time_slot_id) })
    const postedCents = posted.reduce((sum,row) => sum+Number(row.amount_cents)+Number(row.linked_cents),0)
    months.push({ periodKey, monthlyCents, ...tuition, postedCents,
      differenceCents: tuition.amountCents-postedCents, chargeId: posted[0] ? Number(posted[0].id) : null })
  }
  const result = { signupId: Number(signupId), accountId: Number(context.family_billing_account_id), memberId: Number(context.member_id),
    subscriptionId: Number(context.billing_subscription_id), className: context.class_name,
    previousDate: oldDate, ...request, months, nextFullBillingDate: firstOfNextMonth(request.firstBillingDate),
    totalDifferenceCents: months.reduce((sum,row) => sum+row.differenceCents,0) }
  return { ...result, previewHash: hash(result) }
}

export async function applyEnrollmentStartDateAdjustment(pool, { signupId, facilityId, actorUserId, requestKey, input }) {
  if (!actorUserId || !requestKey || !input?.previewHash) throw new Error('An administrator, reviewed preview, and request key are required.')
  const request = normalizeStartDateAdjustment(input)
  const fingerprint = hash({ signupId, ...request, previewHash: input.previewHash })
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const context = await loadEnrollmentPriceContext(db, signupId, facilityId)
    const accountId = Number(context.family_billing_account_id)
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))',[`household-monthly-invoice:${accountId}`])
    await db.query('SELECT id FROM scheduling_signup WHERE id=$1 FOR UPDATE',[signupId])
    await db.query('SELECT id FROM billing_subscription WHERE id=$1 FOR UPDATE',[context.billing_subscription_id])
    const eventKey = `enrollment-start-date:${signupId}:${requestKey}`
    const prior = (await db.query('SELECT after_value,details FROM billing_account_activity WHERE event_key=$1 AND family_billing_account_id=$2',[eventKey,accountId])).rows[0]
    if (prior) {
      if (prior.details?.fingerprint !== fingerprint) throw new Error('This request key belongs to a different date adjustment.')
      await db.query('COMMIT'); return { ...prior.after_value, replayed: true }
    }
    const conflict = await findEnrollmentCheckoutCreationConflict(db,accountId) || await findActivePurchaseCheckoutOwner(db,accountId)
    if (conflict) throw new Error('Resolve the account’s open invoice or payment collection before changing the first billing date.')
    const attempts = await db.query(`SELECT id FROM billing_payment_attempt WHERE family_billing_account_id=$1
      AND (status IN ('pending','processing','reconciliation_required') OR (status='reserved' AND expires_at>now())) LIMIT 1`,[accountId])
    if (attempts.rows.length) throw new Error('A payment is in progress. Complete or cancel it before adjusting the start date.')
    const preview = await previewEnrollmentStartDateAdjustment(db,{signupId,facilityId,input})
    if (preview.previewHash !== input.previewHash) throw new Error('Billing changed since this preview. Review the updated amounts before saving.')
    for (const month of preview.months) {
      if (!month.differenceCents) continue
      const adjustment = month.chargeId != null
      const amount = month.differenceCents
      await db.query(`INSERT INTO billing_charge (family_billing_account_id,member_id,subscription_id,
        source_type,source_id,related_charge_id,description,amount_cents,gross_amount_cents,discount_amount_cents,
        charge_type,billing_interval,service_period_start,service_period_end,created_by_user_id,metadata)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,0,$9,$10,$11::date,$12::date,$13,$14::jsonb)`,
        [accountId,preview.memberId,preview.subscriptionId,adjustment?'charge_adjustment':'billing_subscription',
          adjustment?`${eventKey}:${month.periodKey}`:`${preview.subscriptionId}:${month.periodKey}`,month.chargeId,
          `Start date adjustment · ${preview.className} · ${month.periodKey}`,amount,
          adjustment?(amount<0?'credit':'adjustment'):'recurring',adjustment?'one_time':'month',
          `${month.periodKey}-01`,monthBounds(`${month.periodKey}-01`).monthEnd,actorUserId,
          JSON.stringify({firstBillingDate:preview.firstBillingDate,previousDate:preview.previousDate,reason:preview.reason,signupId:Number(signupId)})])
    }
    await db.query('UPDATE scheduling_signup SET enrollment_start_date=$2::date WHERE id=$1',[signupId,preview.firstBillingDate])
    await db.query(`UPDATE billing_subscription SET start_date=$2::date,
      next_bill_date=GREATEST(next_bill_date,$3::date),updated_at=now() WHERE id=$1`,[preview.subscriptionId,preview.firstBillingDate,preview.nextFullBillingDate])
    await allocateHouseholdPaymentsLocked(db,{accountId,actorType:'admin',manageTransaction:false})
    await recordBillingActivity(db,{eventKey,accountId,memberId:preview.memberId,signupId,
      eventType:'enrollment_start_date_adjusted',summary:`First billing date adjusted for ${preview.className}; tuition recalculated.`,
      beforeValue:{firstBillingDate:preview.previousDate},afterValue:preview,details:{fingerprint},actorUserId})
    await db.query('COMMIT'); return { ...preview, replayed:false }
  } catch(error) { await db.query('ROLLBACK'); throw error } finally { db.release() }
}
