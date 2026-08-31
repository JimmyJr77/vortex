import { prorationForLine } from '../scheduling/firstMonthProration.js'
import { allocateHouseholdPayments } from './paymentAllocation.js'
import { recordBillingActivityBestEffort } from './billingActivity.js'

function dateOnly(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value ?? '').slice(0, 10)
}

function firstOfNextMonth(value) {
  const date = new Date(`${dateOnly(value)}T12:00:00Z`)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10)
}

function lastOfMonth(value) {
  const date = new Date(`${dateOnly(value)}T12:00:00Z`)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10)
}

function sameMonth(left, right) {
  return dateOnly(left).slice(0, 7) === dateOnly(right).slice(0, 7)
}

/**
 * Build the corrective ledger plan for a legacy full-price, late-start signup.
 * The legacy full charge becomes the following full calendar month; any actual
 * remaining first-month classes become their own immutable prorated charge.
 */
export function planLateStartEnrollmentRepair(charge, calendarRows) {
  const enrollmentStart = dateOnly(charge.enrollment_start_date)
  if (!enrollmentStart) return null
  const proration = prorationForLine(calendarRows, {
    slotGroupId: Number(charge.slot_group_id),
    timeSlotId: charge.time_slot_id == null ? null : Number(charge.time_slot_id),
    fromDate: enrollmentStart,
  })
  const ratio = Math.max(0, Math.min(1, Number(proration.ratio) || 0))
  // A full first month is already correctly represented by the existing charge.
  if (!proration.classStartsFutureMonth && ratio >= 1) return null

  const nextPeriodStart = firstOfNextMonth(enrollmentStart)
  const needsPeriodMove = !sameMonth(charge.service_period_start, nextPeriodStart)
  const monthlyGrossCents = Math.max(0, Number(charge.monthly_amount_cents) || 0)
  const monthlyNetCents = Math.max(0, Number(charge.net_monthly_cents) || 0)
  const proratedNetCents = proration.classStartsFutureMonth ? 0 : Math.round(monthlyNetCents * ratio)
  const proratedGrossCents = proration.classStartsFutureMonth ? 0 : Math.round(monthlyGrossCents * ratio)

  return {
    ...charge,
    enrollmentStart,
    nextPeriodStart,
    nextPeriodEnd: lastOfMonth(nextPeriodStart),
    needsPeriodMove,
    proration,
    proratedNetCents,
    proratedGrossCents,
    proratedDiscountCents: Math.max(0, proratedGrossCents - proratedNetCents),
  }
}

export async function repairLateStartEnrollmentProration(pool, {
  accountIds = [],
  apply = false,
  actorType = 'system',
} = {}) {
  const candidateResult = await pool.query(
    `SELECT charge.id AS charge_id, charge.family_billing_account_id AS account_id,
            charge.member_id, charge.description, charge.amount_cents,
            charge.gross_amount_cents, charge.discount_amount_cents,
            charge.service_period_start, charge.service_period_end,
            subscription.id AS subscription_id, subscription.monthly_amount_cents,
            subscription.discount_amount_cents AS monthly_discount_cents,
            subscription.net_monthly_cents,
            signup.id AS signup_id, signup.slot_group_id, signup.time_slot_id,
            signup.enrollment_start_date,
            COALESCE((
              SELECT SUM(-correction.amount_cents)
              FROM billing_charge correction
              WHERE correction.related_charge_id = charge.id
                AND correction.amount_cents < 0
                AND correction.source_type = 'initial_enrollment_proration_correction'
            ), 0)::int AS prior_proration_credit_cents,
            COALESCE((
              SELECT jsonb_agg(correction.id ORDER BY correction.id)
              FROM billing_charge correction
              WHERE correction.related_charge_id = charge.id
                AND correction.amount_cents < 0
                AND correction.source_type = 'initial_enrollment_proration_correction'
            ), '[]'::jsonb) AS prior_proration_credit_ids
       FROM billing_charge charge
       JOIN billing_subscription subscription ON subscription.id = charge.subscription_id
       JOIN scheduling_signup signup
         ON subscription.source_type = 'scheduling_signup'
        AND subscription.source_id ~ '^[0-9]+$'
        AND signup.id = subscription.source_id::bigint
      WHERE charge.charge_type = 'recurring'
        AND charge.source_type = 'scheduling_signup'
        AND charge.amount_cents > 0
        AND charge.amount_cents = subscription.net_monthly_cents
        AND signup.enrollment_start_date > date_trunc('month', signup.enrollment_start_date)::date
        AND (
          charge.service_period_start IS NULL
          OR date_trunc('month', charge.service_period_start)::date = date_trunc('month', signup.enrollment_start_date)::date
        )
        AND NOT EXISTS (
          SELECT 1
          FROM billing_charge correction
          WHERE correction.related_charge_id = charge.id
            AND correction.source_type = 'initial_enrollment_proration'
        )
        AND ($1::bigint[] = '{}'::bigint[] OR charge.family_billing_account_id = ANY($1::bigint[]))
      ORDER BY charge.family_billing_account_id, charge.id`,
    [accountIds],
  )
  const slotGroupIds = [...new Set(candidateResult.rows
    .map((row) => Number(row.slot_group_id))
    .filter(Number.isFinite))]
  const calendarRows = slotGroupIds.length === 0
    ? []
    : (await pool.query(
      `SELECT ts.*, sg.active_start AS sg_active_start, sg.active_end AS sg_active_end,
              sg.dates_tbd AS sg_dates_tbd, sg.inherits_offering_dates AS sg_inherits_offering_dates,
              sg.offering_id AS sg_offering_id, sg.is_active AS sg_is_active,
              sf.start_date AS form_start_date, sf.end_date AS form_end_date,
              sf.title AS form_title, sf.program_id, sf.programs_id, sf.is_active AS form_is_active
         FROM scheduling_time_slot ts
         JOIN scheduling_slot_group sg ON sg.id = ts.slot_group_id
         JOIN scheduling_form sf ON sf.id = ts.form_id
        WHERE ts.slot_group_id = ANY($1::bigint[])`,
      [slotGroupIds],
    )).rows
  const repairs = candidateResult.rows
    .map((charge) => planLateStartEnrollmentRepair(charge, calendarRows))
    .filter(Boolean)

  const applied = []
  if (!apply) return { repairs, applied }

  for (const repair of repairs) {
    const client = typeof pool.connect === 'function' ? await pool.connect() : pool
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock($1)', [Number(repair.account_id)])
      if (repair.needsPeriodMove) {
        const updated = await client.query(
          `UPDATE billing_charge
           SET service_period_start = $2::date, service_period_end = $3::date
           WHERE id = $1
             AND (service_period_start IS NULL OR date_trunc('month', service_period_start)::date <> date_trunc('month', $2::date)::date)
           RETURNING *`,
          [repair.charge_id, repair.nextPeriodStart, repair.nextPeriodEnd],
        )
        if (updated.rows[0]) {
          await recordBillingActivityBestEffort(client, {
            eventKey: `late-start-full-tuition-period:${repair.charge_id}`,
            accountId: Number(repair.account_id),
            memberId: repair.member_id == null ? null : Number(repair.member_id),
            signupId: Number(repair.signup_id),
            chargeId: Number(repair.charge_id),
            eventType: 'initial_enrollment_full_tuition_reassigned',
            summary: 'Full enrollment tuition was assigned to the first full calendar month.',
            beforeValue: {
              servicePeriodStart: repair.service_period_start,
              servicePeriodEnd: repair.service_period_end,
            },
            afterValue: {
              servicePeriodStart: repair.nextPeriodStart,
              servicePeriodEnd: repair.nextPeriodEnd,
            },
            details: { enrollmentStart: repair.enrollmentStart },
            actorType,
          })
        }
      }
      let prorationCharge = null
      let creditReversalCharge = null
      const priorCreditCents = Math.max(0, Number(repair.prior_proration_credit_cents) || 0)
      if (priorCreditCents > 0) {
        const result = await client.query(
          `INSERT INTO billing_charge (
             family_billing_account_id, member_id, source_type, source_id, related_charge_id,
             description, amount_cents, gross_amount_cents, discount_amount_cents,
             charge_type, billing_interval, service_period_start, service_period_end,
             collection_status, metadata
           ) VALUES (
             $1, $2, 'initial_enrollment_proration_credit_reversal', $3, $4,
             $5, $6, $6, 0,
             'adjustment', 'one_time', $7::date, $8::date,
             'unpaid', $9::jsonb
           )
           ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
           RETURNING *`,
          [
            repair.account_id,
            repair.member_id,
            `late-start-credit-reversal:${repair.charge_id}`,
            repair.charge_id,
            `Reversal of prior proration credit — ${repair.description}`,
            priorCreditCents,
            repair.enrollmentStart,
            lastOfMonth(repair.enrollmentStart),
            JSON.stringify({
              originalChargeId: Number(repair.charge_id),
              reversedCreditChargeIds: repair.prior_proration_credit_ids ?? [],
              reason: 'reassign_full_tuition_to_first_full_month',
            }),
          ],
        )
        creditReversalCharge = result.rows[0] ?? null
        if (creditReversalCharge) {
          await recordBillingActivityBestEffort(client, {
            eventKey: `late-start-proration-credit-reversal:${repair.charge_id}`,
            accountId: Number(repair.account_id),
            memberId: repair.member_id == null ? null : Number(repair.member_id),
            signupId: Number(repair.signup_id),
            chargeId: Number(creditReversalCharge.id),
            eventType: 'initial_enrollment_proration_credit_reversed',
            summary: 'An obsolete initial-proration credit was offset after reassigning full tuition to its service month.',
            afterValue: { amountCents: Number(creditReversalCharge.amount_cents) },
            details: {
              originalChargeId: Number(repair.charge_id),
              reversedCreditChargeIds: repair.prior_proration_credit_ids ?? [],
            },
            actorType,
          })
        }
      }
      if (repair.proratedNetCents > 0) {
        const result = await client.query(
          `INSERT INTO billing_charge (
             family_billing_account_id, member_id, source_type, source_id, related_charge_id,
             description, amount_cents, gross_amount_cents, discount_amount_cents,
             charge_type, billing_interval, subscription_id,
             service_period_start, service_period_end, collection_status, metadata
           ) VALUES (
             $1, $2, 'initial_enrollment_proration', $3, $4,
             $5, $6, $7, $8,
             'recurring', 'month', $9,
             $10::date, $11::date, 'unpaid', $12::jsonb
           )
           ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
           RETURNING *`,
          [
            repair.account_id,
            repair.member_id,
            `late-start:${repair.charge_id}`,
            repair.charge_id,
            `First-month prorated tuition — ${repair.description}`,
            repair.proratedNetCents,
            repair.proratedGrossCents,
            repair.proratedDiscountCents,
            repair.subscription_id,
            repair.enrollmentStart,
            lastOfMonth(repair.enrollmentStart),
            JSON.stringify({
              originalChargeId: Number(repair.charge_id),
              enrollmentStart: repair.enrollmentStart,
              remainingClasses: repair.proration.remainingClasses,
              classesPerMonth: 4,
              ratio: repair.proration.ratio,
              reason: 'initial_enrollment_partial_month',
            }),
          ],
        )
        prorationCharge = result.rows[0] ?? null
        if (prorationCharge) {
          await recordBillingActivityBestEffort(client, {
            eventKey: `late-start-prorated-tuition:${repair.charge_id}`,
            accountId: Number(repair.account_id),
            memberId: repair.member_id == null ? null : Number(repair.member_id),
            signupId: Number(repair.signup_id),
            chargeId: Number(prorationCharge.id),
            eventType: 'initial_enrollment_proration_posted',
            summary: 'A scheduled partial-month enrollment charge was posted.',
            afterValue: { amountCents: Number(prorationCharge.amount_cents) },
            details: {
              originalChargeId: Number(repair.charge_id),
              servicePeriodStart: repair.enrollmentStart,
              servicePeriodEnd: lastOfMonth(repair.enrollmentStart),
              remainingClasses: repair.proration.remainingClasses,
              classesPerMonth: 4,
              ratio: repair.proration.ratio,
            },
            actorType,
          })
        }
      }
      await client.query('COMMIT')
      applied.push({
        chargeId: Number(repair.charge_id),
        creditReversalChargeId: creditReversalCharge == null ? null : Number(creditReversalCharge.id),
        prorationChargeId: prorationCharge == null ? null : Number(prorationCharge.id),
      })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      if (client !== pool && typeof client.release === 'function') client.release()
    }
  }
  for (const accountId of new Set(repairs.map((repair) => Number(repair.account_id)))) {
    await allocateHouseholdPayments(pool, {
      accountId,
      actorType,
      idempotencyNamespace: 'late-start-proration',
    })
  }
  return { repairs, applied }
}
