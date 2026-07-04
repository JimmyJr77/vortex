/**
 * Idempotent repair for enrollment checkout gaps — missing signup charges, fees,
 * or Stripe payments after a completed pending enrollment.
 */

import { getStripeClient, recordEnrollmentStripePayment } from './stripeBilling.js'
import { persistSignupCharges } from '../scheduling/persistSignupCharges.js'

function parsePreview(snapshot) {
  if (!snapshot) return null
  return typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot
}

async function loadSignupsForPending(pool, pending) {
  const subsRes = await pool.query(
    `
      SELECT bs.source_id
      FROM billing_subscription bs
      WHERE bs.family_billing_account_id = $1
        AND bs.member_id = $2
        AND bs.source_type = 'scheduling_signup'
        AND bs.status = 'active'
    `,
    [pending.family_billing_account_id, pending.member_id],
  )
  const signupIds = subsRes.rows.map((r) => Number(r.source_id)).filter(Number.isFinite)
  if (signupIds.length === 0) {
    const windowRes = await pool.query(
      `
        SELECT ss.id, ss.form_id, ss.slot_group_id, ss.time_slot_id,
               sf.title AS form_title
        FROM scheduling_signup ss
        JOIN scheduling_form sf ON sf.id = ss.form_id
        WHERE ss.member_id = $1
          AND ss.created_at >= $2::timestamptz - interval '2 hours'
          AND ss.created_at <= $2::timestamptz + interval '2 hours'
        ORDER BY ss.id
      `,
      [pending.member_id, pending.updated_at ?? pending.created_at],
    )
    return windowRes.rows.map((row) => ({
      signupId: Number(row.id),
      formId: Number(row.form_id),
      slotGroupId: Number(row.slot_group_id),
      timeSlotId: row.time_slot_id != null ? Number(row.time_slot_id) : null,
      formTitle: row.form_title ?? 'Class enrollment',
      slotLabel: '',
    }))
  }

  const signupRes = await pool.query(
    `
      SELECT ss.id, ss.form_id, ss.slot_group_id, ss.time_slot_id,
             sf.title AS form_title
      FROM scheduling_signup ss
      JOIN scheduling_form sf ON sf.id = ss.form_id
      WHERE ss.id = ANY($1::bigint[])
      ORDER BY ss.id
    `,
    [signupIds],
  )

  return signupRes.rows.map((row) => ({
    signupId: Number(row.id),
    formId: Number(row.form_id),
    slotGroupId: Number(row.slot_group_id),
    timeSlotId: row.time_slot_id != null ? Number(row.time_slot_id) : null,
    formTitle: row.form_title ?? 'Class enrollment',
    slotLabel: '',
  }))
}

async function pendingEnrollmentNeedsRepair(pool, accountId) {
  try {
    const res = await pool.query(
    `
      SELECT pe.id
      FROM stripe_pending_enrollment pe
      WHERE pe.family_billing_account_id = $1
        AND pe.status = 'completed'
        AND pe.preview_snapshot IS NOT NULL
        AND (
          (
            pe.stripe_checkout_session_id IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM billing_payment p
              WHERE p.family_billing_account_id = $1
                AND p.stripe_checkout_session_id = pe.stripe_checkout_session_id
            )
          )
          OR EXISTS (
            SELECT 1 FROM billing_subscription bs
            WHERE bs.family_billing_account_id = $1
              AND bs.member_id = pe.member_id
              AND bs.source_type = 'scheduling_signup'
              AND bs.status = 'active'
              AND NOT EXISTS (
                SELECT 1 FROM billing_charge c
                WHERE c.family_billing_account_id = $1
                  AND c.source_type = 'scheduling_signup'
                  AND c.source_id = bs.source_id
              )
          )
        )
      LIMIT 1
    `,
    [accountId],
  )
    return res.rows.length > 0
  } catch (err) {
    if (err?.code === '42P01') return false
    throw err
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ id:number, family_id:number }} account
 * @returns {Promise<{ repaired: boolean }>}
 */
export async function reconcileEnrollmentLedger(pool, account) {
  if (!account?.id) return { repaired: false }

  const needsRepair = await pendingEnrollmentNeedsRepair(pool, account.id)
  if (!needsRepair) return { repaired: false }

  const pendingRows = await pool.query(
    `
      SELECT *
      FROM stripe_pending_enrollment
      WHERE family_billing_account_id = $1
        AND status = 'completed'
        AND preview_snapshot IS NOT NULL
      ORDER BY updated_at DESC
    `,
    [account.id],
  )

  let repaired = false
  const stripe = await getStripeClient()

  for (const pending of pendingRows.rows) {
    const preview = parsePreview(pending.preview_snapshot)
    const signups = await loadSignupsForPending(pool, pending)
    if (preview && signups.length > 0) {
      const beforeCharges = await pool.query(
        `
          SELECT COUNT(*)::int AS count
          FROM billing_charge
          WHERE family_billing_account_id = $1
            AND source_type IN ('scheduling_signup', 'additional_fee')
        `,
        [account.id],
      )
      await persistSignupCharges(pool, {
        memberId: Number(pending.member_id),
        signups,
        preview,
      })
      const afterCharges = await pool.query(
        `
          SELECT COUNT(*)::int AS count
          FROM billing_charge
          WHERE family_billing_account_id = $1
            AND source_type IN ('scheduling_signup', 'additional_fee')
        `,
        [account.id],
      )
      if (afterCharges.rows[0].count > beforeCharges.rows[0].count) {
        repaired = true
      }
    }

    if (pending.stripe_checkout_session_id && stripe) {
      const existingPayment = await pool.query(
        `
          SELECT id FROM billing_payment
          WHERE family_billing_account_id = $1
            AND stripe_checkout_session_id = $2
          LIMIT 1
        `,
        [account.id, pending.stripe_checkout_session_id],
      )
      if (existingPayment.rows.length === 0) {
        try {
          const session = await stripe.checkout.sessions.retrieve(pending.stripe_checkout_session_id, {
            expand: ['payment_intent', 'invoice.payment_intent'],
          })
          if (session.payment_status === 'paid' || session.status === 'complete') {
            const payment = await recordEnrollmentStripePayment(pool, stripe, {
              session,
              accountId: account.id,
            })
            if (payment) repaired = true
          }
        } catch (err) {
          console.warn('[billing] reconcileEnrollmentLedger payment:', err.message)
        }
      }
    }
  }

  return { repaired }
}
