#!/usr/bin/env node

/**
 * Correct full-price initial recurring charges that should have been prorated
 * from an athlete's enrollment start through the end of that first month.
 * Corrections are append-only credits linked to the original charge; a paid
 * bill therefore becomes a future credit, while an unpaid bill is reduced.
 *
 * Usage:
 *   npm run billing:repair-initial-proration
 *   npm run billing:repair-initial-proration -- --apply
 *   npm run billing:repair-initial-proration -- --account-ids=10903,10906
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'
import { prorationForLine } from '../scheduling/firstMonthProration.js'
import { recordBillingActivityBestEffort } from '../billing/billingActivity.js'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(scriptDir, '..', '.env.local') })
dotenv.config({ path: path.join(scriptDir, '..', '.env') })

function argument(name) {
  return process.argv.find((entry) => entry.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null
}

function numberList(name) {
  return String(argument(name) ?? '').split(',').map(Number).filter((value) => Number.isFinite(value) && value > 0)
}

function dateOnly(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value ?? '').slice(0, 10)
}

function needsSsl(value) {
  return /render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(String(value))
}

const apply = process.argv.includes('--apply')
const requestedAccountIds = numberList('account-ids')
const connectionString = process.env.EXTERNAL_DB_URL || process.env.DATABASE_URL || process.env.DB_URL
if (!connectionString) throw new Error('A database connection URL is required.')
const pool = new pg.Pool({ connectionString, ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : false })

try {
  const charges = await pool.query(
    `SELECT charge.id AS charge_id, charge.family_billing_account_id AS account_id,
            charge.member_id, charge.description, charge.amount_cents,
            charge.gross_amount_cents, charge.discount_amount_cents,
            charge.service_period_start, charge.service_period_end,
            subscription.id AS subscription_id, subscription.monthly_amount_cents,
            subscription.discount_amount_cents AS monthly_discount_cents,
            subscription.net_monthly_cents,
            signup.id AS signup_id, signup.slot_group_id, signup.time_slot_id,
            signup.enrollment_start_date
       FROM billing_charge charge
       JOIN billing_subscription subscription ON subscription.id = charge.subscription_id
       JOIN scheduling_signup signup
         ON subscription.source_type = 'scheduling_signup'
        AND subscription.source_id ~ '^[0-9]+$'
        AND signup.id = subscription.source_id::bigint
      WHERE charge.charge_type = 'recurring'
        AND charge.source_type = 'scheduling_signup'
        AND charge.amount_cents > 0
        AND charge.service_period_start = signup.enrollment_start_date
        AND NOT EXISTS (
          SELECT 1 FROM billing_charge correction
           WHERE correction.related_charge_id = charge.id
             AND correction.source_type = 'initial_enrollment_proration_correction'
        )
        AND ($1::bigint[] = '{}'::bigint[] OR charge.family_billing_account_id = ANY($1::bigint[]))
      ORDER BY charge.family_billing_account_id, charge.id`,
    [requestedAccountIds],
  )
  const slotGroupIds = [...new Set(charges.rows.map((row) => Number(row.slot_group_id)).filter(Number.isFinite))]
  const calendarRows = slotGroupIds.length === 0
    ? []
    : (await pool.query(
      `SELECT ts.*, sg.active_start AS sg_active_start, sg.active_end AS sg_active_end,
              sg.dates_tbd AS sg_dates_tbd, sg.inherits_offering_dates AS sg_inherits_offering_dates,
              sg.offering_id AS sg_offering_id, sg.is_active AS sg_is_active,
              sf.start_date AS form_start_date, sf.end_date AS form_end_date,
              sf.title AS form_title, sf.program_id, sf.programs_id,
              sf.is_active AS form_is_active
         FROM scheduling_time_slot ts
         JOIN scheduling_slot_group sg ON sg.id = ts.slot_group_id
         JOIN scheduling_form sf ON sf.id = ts.form_id
        WHERE ts.slot_group_id = ANY($1::bigint[])`,
      [slotGroupIds],
    )).rows

  const corrections = []
  for (const charge of charges.rows) {
    const startDate = dateOnly(charge.enrollment_start_date)
    const proration = prorationForLine(calendarRows, {
      slotGroupId: Number(charge.slot_group_id),
      timeSlotId: charge.time_slot_id == null ? null : Number(charge.time_slot_id),
      fromDate: startDate,
    })
    // A future-start enrollment is prepaid separately; only a current-month
    // partial period is corrected here.
    if (proration.classStartsFutureMonth || Number(proration.ratio) >= 1) continue
    const expectedNetCents = Math.round(Number(charge.net_monthly_cents) * Number(proration.ratio))
    const differenceCents = expectedNetCents - Number(charge.amount_cents)
    if (differenceCents >= 0) continue
    corrections.push({
      ...charge,
      startDate,
      expectedNetCents,
      differenceCents,
      remainingClasses: proration.remainingClasses,
      classesPerMonth: 4,
      ratio: proration.ratio,
    })
  }

  const appliedChargeIds = []
  if (apply) {
    for (const correction of corrections) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('SELECT pg_advisory_xact_lock($1)', [Number(correction.account_id)])
        const inserted = await client.query(
          `INSERT INTO billing_charge (
             family_billing_account_id, member_id, source_type, source_id, related_charge_id,
             description, amount_cents, gross_amount_cents, discount_amount_cents,
             charge_type, billing_interval, service_period_start, service_period_end,
             collection_status, metadata
           ) VALUES (
             $1, $2, 'initial_enrollment_proration_correction', $3, $4,
             $5, $6, $6, 0,
             'credit', 'one_time', $7, $8,
             'none', $9::jsonb
           )
           ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
           RETURNING id`,
          [
            correction.account_id,
            correction.member_id,
            `initial-proration:${correction.charge_id}`,
            correction.charge_id,
            `First-month proration credit — ${correction.description}`,
            correction.differenceCents,
            correction.service_period_start,
            correction.service_period_end,
            JSON.stringify({
              originalChargeId: Number(correction.charge_id),
              monthlyNetCents: Number(correction.net_monthly_cents),
              expectedProratedNetCents: correction.expectedNetCents,
              remainingClasses: correction.remainingClasses,
              classesPerMonth: correction.classesPerMonth,
              ratio: correction.ratio,
              reason: 'initial_enrollment_partial_month',
            }),
          ],
        )
        const created = inserted.rows[0]
        if (created) {
          appliedChargeIds.push(Number(correction.charge_id))
          await recordBillingActivityBestEffort(client, {
            eventKey: `initial-enrollment-proration:${correction.charge_id}`,
            accountId: Number(correction.account_id),
            memberId: correction.member_id == null ? null : Number(correction.member_id),
            signupId: Number(correction.signup_id),
            chargeId: Number(correction.charge_id),
            eventType: 'initial_enrollment_proration_repaired',
            summary: 'Initial enrollment tuition corrected to the scheduled partial-month amount.',
            beforeValue: { amountCents: Number(correction.amount_cents) },
            afterValue: { effectiveAmountCents: correction.expectedNetCents, creditChargeId: Number(created.id) },
            details: { remainingClasses: correction.remainingClasses, classesPerMonth: correction.classesPerMonth, ratio: correction.ratio },
            actorType: 'system',
          })
        }
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        client.release()
      }
    }
  }

  console.log(JSON.stringify({
    apply,
    candidateCount: corrections.length,
    appliedChargeIds,
    corrections: corrections.map((item) => ({
      chargeId: Number(item.charge_id),
      accountId: Number(item.account_id),
      description: item.description,
      servicePeriodStart: dateOnly(item.service_period_start),
      servicePeriodEnd: dateOnly(item.service_period_end),
      remainingClasses: item.remainingClasses,
      monthlyNetCents: Number(item.net_monthly_cents),
      expectedProratedNetCents: item.expectedNetCents,
      creditCents: item.differenceCents,
    })),
  }, null, 2))
} finally {
  await pool.end()
}
