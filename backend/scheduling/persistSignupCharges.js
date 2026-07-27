/**
 * Bridge created scheduling signups into the persisted family billing ledger.
 *
 * For each signup we write one `billing_charge` row (idempotent on
 * source_type/source_id) using the per-line pricing from the order preview.
 * Recurring enrollments (per_month / weekly-tier / unlimited / per_hour) also
 * create a `billing_subscription` (the source of truth for the monthly total);
 * the first period (signup → end of the current month) is charged immediately,
 * prorated by the class's remaining sessions this month (preview.firstMonth), and
 * the monthly job posts subsequent full cycles on each 1st. Future-start classes
 * charge the full first service month at signup and record a credit against the
 * first monthly bill. One-time enrollments (per_class / per_offering) post a single
 * per_offering) post a single one-time charge and never create a subscription.
 *
 * Charges carry gross/discount split so statements can show list price, discount,
 * and net. Order-level discounts are recorded once as a credit ledger entry.
 * Additional fees (annual/membership) post `billing_charge` rows (`source_type='additional_fee'`)
 * and once-per-year fees also record `additional_fee_redemption`.
 */

import {
  upsertSubscriptionForSource,
  cancelSubscriptionsForSource,
  deferredFirstBillDate,
} from './billingSubscriptions.js'
import { recordPrepaidFirstMonthCredit } from './pauseEnrollmentBilling.js'
import {
  membershipRenewsOnFromPurchase,
  toUtcDateString,
} from './membershipAnniversary.js'
import { ensureBillingChargeSchema } from '../billing/billingChargeSchema.js'

async function ensureBillingAccount(pool, familyId) {
  const existing = await pool.query(
    `SELECT * FROM family_billing_account WHERE family_id = $1`,
    [familyId],
  )
  if (existing.rows.length > 0) return existing.rows[0]

  const created = await pool.query(
    `
      INSERT INTO family_billing_account (
        family_id, payer_member_id, billing_email, billing_phone,
        billing_street, billing_city, billing_state, billing_zip
      )
      SELECT
        f.id, m.id, m.email, m.phone,
        m.billing_street, m.billing_city, m.billing_state, m.billing_zip
      FROM family f
      LEFT JOIN LATERAL (
        SELECT * FROM member
        WHERE family_id = f.id AND is_active = TRUE
        ORDER BY (email IS NULL), id
        LIMIT 1
      ) m ON TRUE
      WHERE f.id = $1
      ON CONFLICT (family_id) DO UPDATE SET updated_at = now()
      RETURNING *
    `,
    [familyId],
  )
  return created.rows[0] ?? null
}

/**
 * Resolve the per-line gross / discount / net (cents) and billing type for a slot.
 * @returns {{ grossCents:number, discountCents:number, netCents:number, billingType:'recurring'|'one_time', selectedPricingOptionKey:string|null } | null}
 */
function lineChargeForSlot(preview, slotKey) {
  if (!preview) return null
  const item = (preview.newSignups || []).find((s) => s.slotKey === slotKey)
  const billingType = item?.billingType === 'one_time' ? 'one_time' : 'recurring'
  const selectedPricingOptionKey = item?.selectedPricingOptionKey ?? null

  // Prefer the discount engine's per-line result (post free pass + per-line discounts).
  if (preview.discounts?.enabled && Array.isArray(preview.discounts.lines)) {
    const line = preview.discounts.lines.find((l) => l.key === slotKey)
    if (line) {
      const gross = Math.max(0, Math.round(Number(line.baseCents) || 0))
      const discount = (line.applied || []).reduce(
        (sum, a) => sum + Math.round(Number(a.amountCents) || 0),
        0,
      )
      const net = Math.max(0, gross - discount)
      return {
        grossCents: gross,
        discountCents: Math.min(discount, gross),
        netCents: net,
        billingType,
        selectedPricingOptionKey,
        applied: line.applied || [],
      }
    }
  }
  // Fall back to the free-pass-adjusted incremental monthly from the preview.
  if (item) {
    const net = Math.max(0, Math.round((Number(item.incrementalMonthly) || 0) * 100))
    return { grossCents: net, discountCents: 0, netCents: net, billingType, selectedPricingOptionKey, applied: [] }
  }
  return null
}

/**
 * Duration-limited free grants (e.g. "1 month free", "2 weeks free", "4 free
 * classes") zero the checkout charge but must NOT discount the ongoing
 * subscription; instead the first bill is deferred by the free window.
 * Open-ended grants (no duration months/weeks, e.g. "free for program
 * duration") keep the subscription at $0.
 * @returns {{ freeMonths:number, freeWeeks:number, durationFreeCents:number }}
 */
function durationLimitedFreeForLine(line) {
  const entries = (line.applied || []).filter(
    (a) =>
      a?.kind === 'free' &&
      (Number(a.freeDurationMonths) > 0 || Number(a.freeDurationWeeks) > 0),
  )
  if (entries.length === 0) return { freeMonths: 0, freeWeeks: 0, durationFreeCents: 0 }
  return {
    freeMonths: Math.max(0, ...entries.map((a) => Math.round(Number(a.freeDurationMonths) || 0))),
    freeWeeks: Math.max(0, ...entries.map((a) => Math.round(Number(a.freeDurationWeeks) || 0))),
    durationFreeCents: entries.reduce((sum, a) => sum + Math.round(Number(a.amountCents) || 0), 0),
  }
}

function chargeDescription(preview, signup) {
  const summary = preview?.formSummaries?.find((s) => s.formId === signup.formId)
  if (summary?.usesWeeklyTierPricing && summary.weeklyTierLabel) {
    const slotPart = signup.slotLabel ? ` · ${signup.slotLabel}` : ''
    return `${summary.formTitle} — ${summary.weeklyTierLabel}${slotPart}`
  }
  return [signup.formTitle, signup.slotLabel].filter(Boolean).join(' — ') || 'Class enrollment'
}

/**
 * @param {import('pg').Pool} pool
 * @param {object} args
 * @param {number} args.memberId enrolled athlete
 * @param {Array<{signupId:number, formId:number, slotGroupId:number, timeSlotId:number, formTitle:string, slotLabel:string}>} args.signups
 * @param {object|null} args.preview full order preview built at batch time
 */
export async function persistSignupCharges(pool, { memberId, signups = [], preview = null }) {
  if (!memberId || signups.length === 0) return { charges: 0, subscriptions: 0 }

  await ensureBillingChargeSchema(pool)

  let familyId = null
  try {
    const res = await pool.query('SELECT family_id FROM member WHERE id = $1', [memberId])
    familyId = res.rows[0]?.family_id != null ? Number(res.rows[0].family_id) : null
  } catch {
    familyId = null
  }
  if (familyId == null) return { charges: 0, subscriptions: 0 }

  const account = await ensureBillingAccount(pool, familyId)
  if (!account) return { charges: 0, subscriptions: 0 }

  const firstMonth = preview?.firstMonth?.enabled ? preview.firstMonth : null
  const firstMonthBySlotKey = new Map((firstMonth?.items || []).map((item) => [item.slotKey, item]))
  // Track prorated amounts so the order-level discount credit can be prorated too.
  let proratedNetSum = 0
  let proratedEffectiveSum = 0
  let usedProration = false

  let charges = 0
  let subscriptions = 0
  for (const signup of signups) {
    const slotKey = `${signup.formId}:${signup.slotGroupId}:${signup.timeSlotId ?? 'none'}`
    const line = lineChargeForSlot(preview, slotKey)
    if (line == null) continue

    const description = chargeDescription(preview, signup)
    let subscriptionId = null
    let servicePeriodStart = null
    let servicePeriodEnd = null
    let chargeType = 'one_time'
    let billingInterval = 'one_time'

    const fm = line.billingType === 'recurring' ? firstMonthBySlotKey.get(slotKey) ?? null : null
    let chargeGross = line.grossCents
    let chargeDiscount = line.discountCents
    let chargeNet = line.netCents
    if (fm) {
      usedProration = true
      const tuitionCents = fm.classStartsFutureMonth
        ? Math.round(Number(fm.prepaidFirstMonthCents) || 0)
        : Math.round(Number(fm.proratedCents) || 0)
      chargeNet = tuitionCents
      chargeGross = Math.round(line.grossCents * fm.ratio)
      chargeDiscount = Math.max(0, chargeGross - chargeNet)
      proratedNetSum += Math.round(fm.monthlyNetCents * fm.ratio)
      proratedEffectiveSum += chargeNet
    }

    if (line.billingType === 'recurring') {
      chargeType = 'recurring'
      billingInterval = 'month'
      try {
        const baseFirstBill = fm?.classStartsFutureMonth ? fm.firstBillDate : null
        const { freeMonths, freeWeeks, durationFreeCents } = durationLimitedFreeForLine(line)
        const hasDurationFree = freeMonths > 0 || freeWeeks > 0
        // "N months/weeks free" → ongoing subscription at full price, first bill deferred.
        const subscriptionDiscount = hasDurationFree
          ? Math.max(0, line.discountCents - durationFreeCents)
          : line.discountCents
        const firstBillDate = hasDurationFree
          ? deferredFirstBillDate({
              firstBillDate: baseFirstBill,
              freeMonths,
              freeWeeks,
              // For future-start classes count free weeks from the first service day.
              weeksFrom: fm?.classStartsFutureMonth ? fm?.firstServicePeriodStart ?? null : null,
            })
          : baseFirstBill
        const sub = await upsertSubscriptionForSource(pool, {
          familyBillingAccountId: account.id,
          memberId,
          sourceType: 'scheduling_signup',
          sourceId: signup.signupId,
          description,
          monthlyAmountCents: line.grossCents,
          discountAmountCents: subscriptionDiscount,
          pricingOptionKey: line.selectedPricingOptionKey,
          firstBillDate,
        })
        if (sub) {
          subscriptionId = sub.id
          if (fm?.firstServicePeriodStart && fm?.firstServicePeriodEnd) {
            servicePeriodStart = fm.firstServicePeriodStart
            servicePeriodEnd = fm.firstServicePeriodEnd
          } else {
            servicePeriodStart = sub.cycle.startDate
            servicePeriodEnd = sub.cycle.endDate
          }
          if (sub.created) subscriptions += 1
        }
      } catch (err) {
        console.warn('[scheduling] persistSignupCharges subscription:', err.message)
      }
    }

    // Skip only when there is nothing to charge (e.g. waitlisted/free).
    if (chargeNet <= 0) continue

    const result = await pool.query(
      `
        INSERT INTO billing_charge
          (family_billing_account_id, member_id, source_type, source_id, description,
           amount_cents, gross_amount_cents, discount_amount_cents,
           charge_type, billing_interval, subscription_id,
           service_period_start, service_period_end)
        VALUES ($1, $2, 'scheduling_signup', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
        DO NOTHING
        RETURNING id
      `,
      [
        account.id,
        memberId,
        String(signup.signupId),
        description,
        chargeNet,
        chargeGross,
        chargeDiscount,
        chargeType,
        billingInterval,
        subscriptionId,
        servicePeriodStart,
        servicePeriodEnd,
      ],
    )
    if (result.rows.length > 0) {
      charges += 1
      if (
        fm?.classStartsFutureMonth &&
        Math.round(Number(fm.prepaidFirstMonthCents) || 0) > 0 &&
        line.billingType === 'recurring'
      ) {
        try {
          await recordPrepaidFirstMonthCredit(pool, {
            signupId: signup.signupId,
            memberId,
            familyBillingAccountId: account.id,
            firstMonthItem: fm,
          })
        } catch (err) {
          console.warn('[scheduling] persistSignupCharges prepaid credit:', err.message)
        }
      }
    }
  }

  // Record an order-level discount (apply_to = order_total) as a one-time credit entry.
  // With first-month proration, the credit is scaled the same way as the charges so the
  // first invoice nets out to the preview's prorated total; the recurring rate keeps the
  // full discount via the subscription rows.
  const orderDiscounts = preview?.discounts?.enabled ? preview.discounts.orderDiscounts || [] : []
  const fullOrderDiscountCents = orderDiscounts.reduce(
    (sum, d) => sum + Math.round(Number(d.amountCents) || 0),
    0,
  )
  const orderDiscountCents = usedProration
    ? Math.max(0, Math.min(fullOrderDiscountCents, proratedNetSum - proratedEffectiveSum))
    : fullOrderDiscountCents
  const sortedSignupIds = signups
    .map((s) => Number(s.signupId))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
  const firstSignupId = sortedSignupIds[0] ?? null
  if (orderDiscountCents > 0 && firstSignupId != null) {
    try {
      await pool.query(
        `
          INSERT INTO billing_charge
            (family_billing_account_id, member_id, source_type, source_id, description,
             amount_cents, gross_amount_cents, discount_amount_cents,
             charge_type, billing_interval)
          VALUES ($1, $2, 'order_discount', $3, 'Order discount', $4, $5, 0, 'credit', 'one_time')
          ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
          DO NOTHING
        `,
        [account.id, memberId, String(firstSignupId), -orderDiscountCents, -orderDiscountCents],
      )
    } catch (err) {
      console.warn('[scheduling] persistSignupCharges order discount:', err.message)
    }
  }

  const feeItems = preview?.additionalFees?.enabled ? preview.additionalFees.items || [] : []
  const purchasedAt = new Date()
  const renewsOn = membershipRenewsOnFromPurchase(purchasedAt)
  const renewsOnKey = toUtcDateString(renewsOn) || toUtcDateString(purchasedAt)
  for (const fee of feeItems) {
    const feeAmount = Math.round(Number(fee.amountCents) || 0)
    const feeGross = Math.round(Number(fee.grossAmountCents ?? fee.amountCents) || 0)
    const feeDiscount = Math.max(0, Math.round(Number(fee.discountCents) || 0))
    if (fee.feeId == null) continue
    // Promo-waived membership fees post at $0 (gross/discount split preserved)
    // so the membership still activates; other zero fees stay skipped.
    if (feeAmount <= 0 && feeDiscount <= 0) continue

    const isAnnualMembership =
      fee.triggerType === 'once_per_year' || fee.applyBasis === 'per_year'
    const sourceId = isAnnualMembership
      ? `${fee.feeId}:${memberId}:${renewsOnKey}`
      : `${fee.feeId}:${firstSignupId ?? memberId}`

    try {
      const feeCharge = await pool.query(
        `
          INSERT INTO billing_charge
            (family_billing_account_id, member_id, source_type, source_id, description,
             amount_cents, gross_amount_cents, discount_amount_cents,
             charge_type, billing_interval)
          VALUES ($1, $2, 'additional_fee', $3, $4, $5, $6, $7, 'one_time', 'one_time')
          ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
          DO NOTHING
          RETURNING id
        `,
        [account.id, memberId, sourceId, fee.name || 'Additional fee', feeAmount, feeGross, feeDiscount],
      )
      if (feeCharge.rows.length > 0) charges += 1
    } catch (err) {
      console.warn('[scheduling] persistSignupCharges additional fee charge:', err.message)
    }

    if (fee.promoRuleId != null && feeDiscount > 0) {
      try {
        await pool.query(
          `INSERT INTO discount_redemption
            (rule_id, member_id, signup_id, program_id, form_id, kind, units, amount_cents)
           VALUES ($1, $2, $3, NULL, NULL, 'discount', 0, $4)`,
          [fee.promoRuleId, memberId, firstSignupId, feeDiscount],
        )
        await pool.query(
          `UPDATE discount_rule SET redeemed_count = redeemed_count + 1, updated_at = now() WHERE id = $1`,
          [fee.promoRuleId],
        )
      } catch (err) {
        console.warn('[scheduling] persistSignupCharges fee promo redemption:', err.message)
      }
    }

    if (!isAnnualMembership) continue
    try {
      await pool.query(
        `
          INSERT INTO additional_fee_redemption
            (fee_id, member_id, signup_id, period_key, amount_cents)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (fee_id, member_id, period_key) DO NOTHING
        `,
        [fee.feeId, memberId, firstSignupId, renewsOnKey, feeAmount],
      )
    } catch (err) {
      console.warn('[scheduling] persistSignupCharges fee redemption:', err.message)
    }
  }

  return { charges, subscriptions }
}

export { ensureBillingAccount, cancelSubscriptionsForSource }
