#!/usr/bin/env node
/**
 * One-time backfill for family billing account 461 (Jimmy enrollment checkout).
 *
 * Usage:
 *   cd backend
 *   STRIPE_SECRET_KEY=sk_test_... DATABASE_URL=... node scripts/backfill-billing-account-461.mjs
 *
 * Idempotent — safe to re-run.
 */

import pg from 'pg'
import { recordEnrollmentStripePayment, getStripeClient } from '../billing/stripeBilling.js'
import { calendarYearKey } from '../scheduling/additionalFeesEngine.js'

const ACCOUNT_ID = 461
const PENDING_ENROLLMENT_ID = 9
const CHECKOUT_SESSION_ID = 'cs_test_b1NBuhvlZk32oKJFK3XvXxCjgtWxGECsRAuqqwYuM8P0tB1O0GI66T9udG'

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const pendingRes = await pool.query(
      `SELECT pe.*, m.family_id
       FROM stripe_pending_enrollment pe
       JOIN member m ON m.id = pe.member_id
       WHERE pe.id = $1`,
      [PENDING_ENROLLMENT_ID],
    )
    const pending = pendingRes.rows[0]
    if (!pending) {
      throw new Error(`Pending enrollment ${PENDING_ENROLLMENT_ID} not found`)
    }

    const preview =
      typeof pending.preview_snapshot === 'string'
        ? JSON.parse(pending.preview_snapshot)
        : pending.preview_snapshot

    const signupsRes = await pool.query(
      `SELECT id FROM scheduling_signup
       WHERE member_id = $1 AND created_at >= $2::timestamptz - interval '1 day'
       ORDER BY id`,
      [pending.member_id, pending.created_at],
    )
    const signupIds = signupsRes.rows.map((r) => Number(r.id))
    const firstSignupId = signupIds[0] ?? null
    const memberId = Number(pending.member_id)
    const year = calendarYearKey(new Date(pending.created_at))

    for (const fee of preview?.additionalFees?.items ?? []) {
      const amount = Math.round(Number(fee.amountCents) || 0)
      if (amount <= 0 || fee.feeId == null) continue
      const sourceId =
        fee.triggerType === 'once_per_year'
          ? `${fee.feeId}:${memberId}:${year}`
          : `${fee.feeId}:${firstSignupId ?? memberId}`
      await pool.query(
        `
          INSERT INTO billing_charge
            (family_billing_account_id, member_id, source_type, source_id, description,
             amount_cents, gross_amount_cents, discount_amount_cents,
             charge_type, billing_interval, stripe_checkout_session_id)
          VALUES ($1, $2, 'additional_fee', $3, $4, $5, $5, 0, 'one_time', 'one_time', $6)
          ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
          DO UPDATE SET stripe_checkout_session_id = COALESCE(
            billing_charge.stripe_checkout_session_id,
            EXCLUDED.stripe_checkout_session_id
          )
        `,
        [ACCOUNT_ID, memberId, sourceId, fee.name || 'Additional fee', amount, CHECKOUT_SESSION_ID],
      )
      console.log('[backfill] additional_fee charge', sourceId, amount)
    }

    if (preview?.firstMonth?.enabled) {
      for (const signupId of signupIds) {
        const signupRes = await pool.query(
          `SELECT form_id, slot_group_id, time_slot_id FROM scheduling_signup WHERE id = $1`,
          [signupId],
        )
        const signup = signupRes.rows[0]
        if (!signup) continue
        const slotKey = `${signup.form_id}:${signup.slot_group_id}:${signup.time_slot_id ?? 'none'}`
        const fm = (preview.firstMonth.items ?? []).find((item) => item.slotKey === slotKey)
        if (!fm) continue
        const tuitionCents = fm.classStartsFutureMonth
          ? Math.round(Number(fm.prepaidFirstMonthCents) || 0)
          : Math.round(Number(fm.proratedCents) || 0)
        if (tuitionCents <= 0) continue

        const existing = await pool.query(
          `SELECT id FROM billing_charge WHERE source_type = 'scheduling_signup' AND source_id = $1`,
          [String(signupId)],
        )
        if (existing.rows.length === 0) {
          console.warn('[backfill] missing scheduling_signup charge for signup', signupId, '- run persistSignupCharges manually')
        } else {
          await pool.query(
            `UPDATE billing_charge
             SET stripe_checkout_session_id = $2
             WHERE id = $1 AND stripe_checkout_session_id IS NULL`,
            [existing.rows[0].id, CHECKOUT_SESSION_ID],
          )
        }
      }
    }

    const stripe = await getStripeClient()
    if (!stripe) {
      throw new Error('STRIPE_SECRET_KEY required to record payment from Checkout session')
    }
    const session = await stripe.checkout.sessions.retrieve(CHECKOUT_SESSION_ID, {
      expand: ['payment_intent', 'invoice.payment_intent'],
    })
    const payment = await recordEnrollmentStripePayment(pool, stripe, {
      session,
      accountId: ACCOUNT_ID,
    })
    console.log('[backfill] payment row', payment?.id ?? 'already recorded', session.amount_total)

    console.log('[backfill] done for account', ACCOUNT_ID)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
