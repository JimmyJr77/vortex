/**
 * Idempotent repair for enrollment checkout gaps — missing signup charges, fees,
 * or Stripe payments after a completed pending enrollment.
 */

import { getStripeClient } from './stripeBilling.js'
import {
  commitPendingEnrollment,
  findExistingSignupIdsForEnrollmentPayload,
} from './stripeEnrollmentCheckout.js'
import { persistSignupCharges } from '../scheduling/persistSignupCharges.js'
import { allocateHouseholdPayments } from './paymentAllocation.js'
import {
  membershipRenewsOnFromPurchase,
  toUtcDateString,
} from '../scheduling/membershipAnniversary.js'

async function ensureReconcileSchema() {
  // Reconciliation is called from member billing reads. Its tables are created
  // by deploy-time migrations (046, 053–058, 768, and 770), never by a request.
  // Keeping this compatibility hook avoids altering repair behavior while
  // ensuring a cold process cannot execute schema DDL for a portal visit.
}

function parsePreview(snapshot) {
  if (!snapshot) return null
  return typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot
}

async function loadSignupsForPending(pool, pending) {
  const signupIds = await findExistingSignupIdsForEnrollmentPayload(
    pool,
    pending.payload,
    Number(pending.member_id),
  )
  if (signupIds.length === 0) return []

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
      SELECT bs.*, ss.id AS signup_id, ss.member_id,
             ss.form_id, ss.slot_group_id, ss.time_slot_id,
             ss.created_at AS signup_created_at
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

function pendingPayloadContainsGap(pending, gap) {
  let payload = pending?.payload ?? null
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload)
    } catch {
      return false
    }
  }
  return (payload?.signups ?? []).some((entry) => (
    Number(entry?.formId) === Number(gap.form_id)
    && Number(entry?.slotGroupId) === Number(gap.slot_group_id)
    && (
      entry?.timeSlotId == null
        ? gap.time_slot_id == null
        : Number(entry.timeSlotId) === Number(gap.time_slot_id)
    )
  ))
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
      DO UPDATE SET stripe_checkout_session_id = COALESCE(
        billing_charge.stripe_checkout_session_id,
        EXCLUDED.stripe_checkout_session_id
      )
      WHERE EXCLUDED.stripe_checkout_session_id IS NOT NULL
        AND (
          billing_charge.stripe_checkout_session_id IS NULL
          OR billing_charge.stripe_checkout_session_id = EXCLUDED.stripe_checkout_session_id
        )
      RETURNING id, family_billing_account_id, member_id, amount_cents,
                stripe_checkout_session_id
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
  const row = result.rows[0] ?? null
  if (!row && checkoutSessionId) {
    throw new Error(`Enrollment charge ${subRow.signup_id ?? subRow.source_id} is bound to another Checkout Session.`)
  }
  if (row && (
    Number(row.family_billing_account_id) !== Number(accountId)
    || Number(row.member_id) !== Number(subRow.member_id)
    || Number(row.amount_cents) !== amountCents
    || String(row.stripe_checkout_session_id ?? '') !== String(checkoutSessionId ?? '')
  )) {
    throw new Error(`Enrollment charge ${subRow.signup_id ?? subRow.source_id} does not match its paid Checkout.`)
  }
  return Boolean(row)
}

async function insertMissingAdditionalFees(pool, accountId, pending, preview, signups, checkoutSessionId) {
  const feeItems = preview?.additionalFees?.enabled ? preview.additionalFees.items || [] : []
  if (feeItems.length === 0) return false

  const memberId = Number(pending.member_id)
  const firstSignupId = signups[0]?.signupId ?? null
  const purchasedAt = new Date(pending.created_at ?? Date.now())
  const renewsOnKey =
    toUtcDateString(membershipRenewsOnFromPurchase(purchasedAt)) || toUtcDateString(purchasedAt)
  let inserted = false

  for (const fee of feeItems) {
    const feeAmount = Math.round(Number(fee.amountCents) || 0)
    if (feeAmount <= 0 || fee.feeId == null) continue
    const isAnnualMembership =
      fee.triggerType === 'once_per_year' || fee.applyBasis === 'per_year'
    const sourceId = isAnnualMembership
      ? `${fee.feeId}:${memberId}:${renewsOnKey}`
      : `${fee.feeId}:${firstSignupId ?? memberId}`

    const result = await pool.query(
      `
        INSERT INTO billing_charge
          (family_billing_account_id, member_id, source_type, source_id, description,
           amount_cents, gross_amount_cents, discount_amount_cents,
           charge_type, billing_interval, stripe_checkout_session_id, created_at)
        VALUES ($1, $2, 'additional_fee', $3, $4, $5, $5, 0, 'one_time', 'one_time', $6, $7)
        ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
        DO UPDATE SET stripe_checkout_session_id = COALESCE(
          billing_charge.stripe_checkout_session_id,
          EXCLUDED.stripe_checkout_session_id
        )
        WHERE EXCLUDED.stripe_checkout_session_id IS NOT NULL
          AND (
            billing_charge.stripe_checkout_session_id IS NULL
            OR billing_charge.stripe_checkout_session_id = EXCLUDED.stripe_checkout_session_id
          )
        RETURNING id, family_billing_account_id, member_id, amount_cents,
                  stripe_checkout_session_id
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
    const row = result.rows[0] ?? null
    if (!row && checkoutSessionId) {
      throw new Error(`Additional fee charge ${sourceId} is bound to another Checkout Session.`)
    }
    if (row && (
      Number(row.family_billing_account_id) !== Number(accountId)
      || Number(row.member_id) !== memberId
      || Number(row.amount_cents) !== feeAmount
      || String(row.stripe_checkout_session_id ?? '') !== String(checkoutSessionId ?? '')
    )) {
      throw new Error(`Additional fee charge ${sourceId} does not match its paid Checkout.`)
    }
    if (row) inserted = true
  }

  return inserted
}

async function findPendingEnrollmentsMissingPayment(pool, accountId) {
  try {
    const res = await pool.query(
      `
        SELECT pe.*, account.stripe_customer_id, account.payer_member_id
        FROM stripe_pending_enrollment pe
        JOIN family_billing_account account
          ON account.id = pe.family_billing_account_id
         AND account.is_active = TRUE
        WHERE pe.family_billing_account_id = $1
          AND pe.status = 'completed'
          AND pe.due_now_cents > 0
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
export async function reconcileEnrollmentLedger(pool, account, {
  stripeClient = undefined,
} = {}) {
  if (!account?.id) return { repaired: false }

  await ensureReconcileSchema(pool)

  const needsRepair = await accountNeedsLedgerRepair(pool, account.id)
  if (!needsRepair) return { repaired: false }

  let repaired = false
  const stripe = stripeClient === undefined ? await getStripeClient() : stripeClient

  const subscriptionGaps = await findSubscriptionChargeGaps(pool, account.id)
  let completedPendingRows = []

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
    completedPendingRows = pendingRows.rows
  } catch (err) {
    if (err?.code !== '42P01') throw err
  }

  for (const gap of subscriptionGaps) {
    const matchingPending = completedPendingRows.filter((row) => (
      Number(row.member_id) === Number(gap.member_id)
      && row.stripe_checkout_session_id
      && pendingPayloadContainsGap(row, gap)
    ))
    let pending = matchingPending.length === 1 ? matchingPending[0] : null
    let preview = pending ? parsePreview(pending.preview_snapshot) : null
    let signups = pending ? await loadSignupsForPending(pool, pending) : []
    if (!signups.some((signup) => String(signup.signupId) === String(gap.source_id))) {
      // A same-member or nearby signup is not proof that this paid Checkout owns
      // the gap. Repair it as an unbound ledger row and leave cash disposition to
      // the exact pending-enrollment recovery path.
      pending = null
      preview = null
      signups = []
    }
    const checkoutSessionId = pending?.stripe_checkout_session_id ?? null

    if (preview && signups.length > 0) {
      const before = await pool.query(
        `SELECT COUNT(*)::int AS count FROM billing_charge
         WHERE family_billing_account_id = $1 AND source_type IN ('scheduling_signup', 'additional_fee')`,
        [account.id],
      )
      await persistSignupCharges(pool, {
        memberId: Number(gap.member_id),
        signups,
        preview,
        stripeCheckoutSessionId: checkoutSessionId,
        purchasedAt: pending?.created_at ?? null,
      })
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

    const signup = signups.find((s) => String(s.signupId) === String(gap.source_id)) ?? null
    const slotKey = signup
      ? `${signup.formId}:${signup.slotGroupId}:${signup.timeSlotId ?? 'none'}`
      : null

    const stillMissing = await pool.query(
      `SELECT 1 FROM billing_charge
       WHERE family_billing_account_id = $1
         AND source_type = 'scheduling_signup'
         AND source_id = $2
         AND ($3::text IS NULL OR stripe_checkout_session_id = $3)
       LIMIT 1`,
      [account.id, String(gap.source_id), checkoutSessionId],
    )
    if (stillMissing.rows.length === 0) {
      const inserted = await insertSignupChargeFromSubscription(pool, account.id, gap, {
        checkoutSessionId,
        preview,
        slotKey,
      })
      if (inserted) repaired = true
    }

  }

  const missingPayments = await findPendingEnrollmentsMissingPayment(pool, account.id)
  for (const pending of missingPayments) {
    if (!pending.stripe_checkout_session_id || !stripe) continue
    try {
      const session = await stripe.checkout.sessions.retrieve(pending.stripe_checkout_session_id, {
        expand: ['payment_intent', 'invoice.payment_intent'],
      })
      if (session.payment_status !== 'paid') continue
      const outcome = await commitPendingEnrollment(pool, {
        pendingEnrollmentId: Number(pending.id),
        stripeSession: session,
      })
      if (
        outcome?.payment
        && ['completed', 'already_completed', 'quarantined'].includes(String(outcome.status))
      ) {
        repaired = true
      }
    } catch (err) {
      console.warn('[billing] reconcileEnrollmentLedger payment:', err.message)
    }
  }

  if (repaired) {
    await allocateHouseholdPayments(pool, { accountId: account.id, actorType: 'system' })
    console.info('[billing] reconcileEnrollmentLedger repaired account', account.id)
  }

  return { repaired }
}
