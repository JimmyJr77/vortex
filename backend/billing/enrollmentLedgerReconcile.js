/**
 * Idempotent repair for enrollment checkout gaps — missing signup charges, fees,
 * or Stripe payments after a completed pending enrollment.
 */

import { ensureBillingStripeLinksSchema, getStripeClient, recordEnrollmentStripePayment } from './stripeBilling.js'
import { ensureBillingRecurringSchema } from './stripeCatalogSync.js'
import { ensureBillingChargeSchema } from './billingChargeSchema.js'
import { persistSignupCharges } from '../scheduling/persistSignupCharges.js'
import { calendarYearKey } from '../scheduling/additionalFeesEngine.js'

async function runMigrationFile(pool, relativePath) {
  const fs = await import('fs')
  const migrationPath = new URL(relativePath, import.meta.url)
  await pool.query(fs.readFileSync(migrationPath, 'utf8'))
}

async function ensureReconcileSchema(pool) {
  await ensureBillingRecurringSchema(pool)
  await ensureBillingChargeSchema(pool)
  await ensureBillingStripeLinksSchema(pool)
  try {
    await runMigrationFile(pool, '../migrations/057_stripe_pending_enrollment.sql')
  } catch (err) {
    if (!/already exists/i.test(String(err.message))) throw err
  }
}

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
               sf.title AS form_title, ss.created_at
        FROM scheduling_signup ss
        JOIN scheduling_form sf ON sf.id = ss.form_id
        WHERE ss.member_id = $1
          AND ss.created_at >= $2::timestamptz - interval '1 day'
          AND ss.created_at <= $2::timestamptz + interval '1 day'
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
      createdAt: row.created_at,
    }))
  }

  const signupRes = await pool.query(
    `
      SELECT ss.id, ss.form_id, ss.slot_group_id, ss.time_slot_id,
             sf.title AS form_title, ss.created_at
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
    createdAt: row.created_at,
  }))
}

async function findSubscriptionChargeGaps(pool, accountId) {
  const res = await pool.query(
    `
      SELECT bs.*, ss.id AS signup_id, ss.member_id, ss.created_at AS signup_created_at
      FROM billing_subscription bs
      JOIN scheduling_signup ss ON ss.id = bs.source_id::bigint
      WHERE bs.family_billing_account_id = $1
        AND bs.source_type = 'scheduling_signup'
        AND bs.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM billing_charge c
          WHERE c.family_billing_account_id = $1
            AND c.source_type = 'scheduling_signup'
            AND c.source_id = bs.source_id
        )
    `,
    [accountId],
  )
  return res.rows
}

function firstMonthAmountForSlot(preview, slotKey) {
  const fm = (preview?.firstMonth?.items ?? []).find((item) => item.slotKey === slotKey)
  if (!fm) return null
  if (fm.classStartsFutureMonth) {
    return Math.round(Number(fm.prepaidFirstMonthCents) || 0)
  }
  return Math.round(Number(fm.proratedCents) || 0)
}

async function insertSignupChargeFromSubscription(pool, accountId, subRow, { checkoutSessionId = null, preview = null, slotKey = null } = {}) {
  let amountCents = Number(subRow.net_monthly_cents ?? 0)
  if (preview && slotKey) {
    const firstMonth = firstMonthAmountForSlot(preview, slotKey)
    if (firstMonth != null && firstMonth > 0) amountCents = firstMonth
  }
  if (amountCents <= 0) return false

  const result = await pool.query(
    `
      INSERT INTO billing_charge (
        family_billing_account_id, member_id, source_type, source_id, description,
        amount_cents, gross_amount_cents, discount_amount_cents,
        charge_type, billing_interval, subscription_id,
        stripe_checkout_session_id, created_at
      ) VALUES ($1, $2, 'scheduling_signup', $3, $4, $5, $6, $7, 'recurring', 'month', $8, $9, $10)
      ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
      DO NOTHING
      RETURNING id
    `,
    [
      accountId,
      subRow.member_id,
      String(subRow.signup_id ?? subRow.source_id),
      subRow.description,
      amountCents,
      Number(subRow.monthly_amount_cents ?? amountCents),
      Number(subRow.discount_amount_cents ?? 0),
      subRow.id,
      checkoutSessionId,
      subRow.signup_created_at ?? new Date(),
    ],
  )
  return result.rows.length > 0
}

async function insertMissingAdditionalFees(pool, accountId, pending, preview, signups, checkoutSessionId) {
  const feeItems = preview?.additionalFees?.enabled ? preview.additionalFees.items || [] : []
  if (feeItems.length === 0) return false

  const memberId = Number(pending.member_id)
  const firstSignupId = signups[0]?.signupId ?? null
  const year = calendarYearKey(new Date(pending.created_at ?? Date.now()))
  let inserted = false

  for (const fee of feeItems) {
    const feeAmount = Math.round(Number(fee.amountCents) || 0)
    if (feeAmount <= 0 || fee.feeId == null) continue
    const sourceId =
      fee.triggerType === 'once_per_year'
        ? `${fee.feeId}:${memberId}:${year}`
        : `${fee.feeId}:${firstSignupId ?? memberId}`

    const result = await pool.query(
      `
        INSERT INTO billing_charge
          (family_billing_account_id, member_id, source_type, source_id, description,
           amount_cents, gross_amount_cents, discount_amount_cents,
           charge_type, billing_interval, stripe_checkout_session_id, created_at)
        VALUES ($1, $2, 'additional_fee', $3, $4, $5, $5, 0, 'one_time', 'one_time', $6, $7)
        ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
        DO NOTHING
        RETURNING id
      `,
      [
        accountId,
        memberId,
        sourceId,
        fee.name || 'Additional fee',
        feeAmount,
        checkoutSessionId,
        pending.updated_at ?? pending.created_at ?? new Date(),
      ],
    )
    if (result.rows.length > 0) inserted = true
  }

  return inserted
}

async function linkCheckoutSessionToEnrollmentCharges(pool, accountId, { checkoutSessionId, memberId, anchorAt }) {
  if (!checkoutSessionId) return
  await pool.query(
    `
      UPDATE billing_charge
      SET stripe_checkout_session_id = $2
      WHERE family_billing_account_id = $1
        AND member_id = $3
        AND stripe_checkout_session_id IS NULL
        AND created_at >= $4::timestamptz - interval '2 days'
        AND created_at <= $4::timestamptz + interval '2 days'
    `,
    [accountId, checkoutSessionId, memberId, anchorAt],
  )
}

async function findPendingEnrollmentsMissingPayment(pool, accountId) {
  try {
    const res = await pool.query(
      `
        SELECT pe.*
        FROM stripe_pending_enrollment pe
        WHERE pe.family_billing_account_id = $1
          AND pe.status = 'completed'
          AND pe.stripe_checkout_session_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM billing_payment p
            WHERE p.family_billing_account_id = $1
              AND p.stripe_checkout_session_id = pe.stripe_checkout_session_id
          )
      `,
      [accountId],
    )
    return res.rows
  } catch (err) {
    if (err?.code === '42P01' || err?.code === '42703') return []
    throw err
  }
}

async function accountNeedsLedgerRepair(pool, accountId) {
  const gaps = await findSubscriptionChargeGaps(pool, accountId)
  if (gaps.length > 0) return true
  const missingPayments = await findPendingEnrollmentsMissingPayment(pool, accountId)
  return missingPayments.length > 0
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ id:number, family_id:number }} account
 * @returns {Promise<{ repaired: boolean }>}
 */
export async function reconcileEnrollmentLedger(pool, account) {
  if (!account?.id) return { repaired: false }

  await ensureReconcileSchema(pool)

  const needsRepair = await accountNeedsLedgerRepair(pool, account.id)
  if (!needsRepair) return { repaired: false }

  let repaired = false
  const stripe = await getStripeClient()

  const subscriptionGaps = await findSubscriptionChargeGaps(pool, account.id)
  const pendingByMember = new Map()

  try {
    const pendingRows = await pool.query(
      `
        SELECT *
        FROM stripe_pending_enrollment
        WHERE family_billing_account_id = $1
          AND status = 'completed'
        ORDER BY updated_at DESC
      `,
      [account.id],
    )
    for (const row of pendingRows.rows) {
      pendingByMember.set(Number(row.member_id), row)
    }
  } catch (err) {
    if (err?.code !== '42P01') throw err
  }

  for (const gap of subscriptionGaps) {
    const pending = pendingByMember.get(Number(gap.member_id)) ?? null
    const preview = pending ? parsePreview(pending.preview_snapshot) : null
    const signups = pending ? await loadSignupsForPending(pool, pending) : []
    const checkoutSessionId = pending?.stripe_checkout_session_id ?? null

    if (preview && signups.length > 0) {
      const before = await pool.query(
        `SELECT COUNT(*)::int AS count FROM billing_charge
         WHERE family_billing_account_id = $1 AND source_type IN ('scheduling_signup', 'additional_fee')`,
        [account.id],
      )
      await persistSignupCharges(pool, { memberId: Number(gap.member_id), signups, preview })
      const after = await pool.query(
        `SELECT COUNT(*)::int AS count FROM billing_charge
         WHERE family_billing_account_id = $1 AND source_type IN ('scheduling_signup', 'additional_fee')`,
        [account.id],
      )
      if (after.rows[0].count > before.rows[0].count) repaired = true
      if (pending) {
        const feeInserted = await insertMissingAdditionalFees(
          pool,
          account.id,
          pending,
          preview,
          signups,
          checkoutSessionId,
        )
        if (feeInserted) repaired = true
      }
    }

    const signup =
      signups.find((s) => String(s.signupId) === String(gap.source_id)) ?? signups[0] ?? null
    const slotKey = signup
      ? `${signup.formId}:${signup.slotGroupId}:${signup.timeSlotId ?? 'none'}`
      : null

    const stillMissing = await pool.query(
      `SELECT 1 FROM billing_charge
       WHERE family_billing_account_id = $1
         AND source_type = 'scheduling_signup'
         AND source_id = $2
       LIMIT 1`,
      [account.id, String(gap.source_id)],
    )
    if (stillMissing.rows.length === 0) {
      const inserted = await insertSignupChargeFromSubscription(pool, account.id, gap, {
        checkoutSessionId,
        preview,
        slotKey,
      })
      if (inserted) repaired = true
    }

    if (checkoutSessionId && signup) {
      await linkCheckoutSessionToEnrollmentCharges(pool, account.id, {
        checkoutSessionId,
        memberId: Number(gap.member_id),
        anchorAt: signup.createdAt ?? gap.signup_created_at,
      })
    }
  }

  const missingPayments = await findPendingEnrollmentsMissingPayment(pool, account.id)
  for (const pending of missingPayments) {
    if (!pending.stripe_checkout_session_id || !stripe) continue
    try {
      const session = await stripe.checkout.sessions.retrieve(pending.stripe_checkout_session_id, {
        expand: ['payment_intent', 'invoice.payment_intent'],
      })
      if (session.payment_status !== 'paid' && session.status !== 'complete') continue
      const payment = await recordEnrollmentStripePayment(pool, stripe, {
        session,
        accountId: account.id,
        paidAt: session.created ? new Date(session.created * 1000) : null,
      })
      if (payment) {
        repaired = true
        const signups = await loadSignupsForPending(pool, pending)
        const anchorAt = signups[0]?.createdAt ?? pending.updated_at ?? pending.created_at
        await linkCheckoutSessionToEnrollmentCharges(pool, account.id, {
          checkoutSessionId: pending.stripe_checkout_session_id,
          memberId: Number(pending.member_id),
          anchorAt,
        })
      }
    } catch (err) {
      console.warn('[billing] reconcileEnrollmentLedger payment:', err.message)
    }
  }

  if (repaired) {
    console.info('[billing] reconcileEnrollmentLedger repaired account', account.id)
  }

  return { repaired }
}
