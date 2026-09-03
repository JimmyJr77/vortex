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
import { loadOrCreateUnassignedBillingAccount } from '../billing/billingAccountProvisioning.js'

// Compatibility export for older callers; provisioning no longer selects a payer.
const ensureBillingAccount = loadOrCreateUnassignedBillingAccount

function requireCheckoutChargeBinding(result, {
  stripeCheckoutSessionId,
  accountId,
  memberId,
  amountCents,
  label,
}) {
  const row = result?.rows?.[0] ?? null
  if (!stripeCheckoutSessionId) return row
  if (
    !row
    || Number(row.family_billing_account_id) !== Number(accountId)
    || Number(row.member_id) !== Number(memberId)
    || Number(row.amount_cents) !== Number(amountCents)
    || String(row.stripe_checkout_session_id ?? '') !== String(stripeCheckoutSessionId)
  ) {
    const error = new Error(`${label} conflicts with its paid Checkout Session.`)
    error.code = 'PAID_CHECKOUT_CHARGE_BINDING_CONFLICT'
    throw error
  }
  return row
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

async function persistSignupPricingSnapshots(pool, preview, signups) {
  if (!preview || signups.length === 0) return
  const discountLines = new Map(
    (preview.discounts?.lines ?? []).map((line) => [line.key, line]),
  )
  for (const signup of signups) {
    const slotKey = `${signup.formId}:${signup.slotGroupId}:${signup.timeSlotId ?? 'none'}`
    const line = discountLines.get(slotKey)
    const signupItem = (preview.newSignups ?? []).find((item) => item.slotKey === slotKey)
    if (!line && !signupItem) continue
    try {
      await pool.query(
        `UPDATE scheduling_signup
         SET pricing_breakdown = COALESCE(pricing_breakdown, $2::jsonb)
         WHERE id = $1`,
        [
          signup.signupId,
          JSON.stringify({
            line: line ?? null,
            billingType: signupItem?.billingType ?? 'recurring',
            selectedPricingOptionKey: signupItem?.selectedPricingOptionKey ?? null,
            orderDiscounts: preview.discounts?.orderDiscounts ?? [],
            totals: {
              subtotalCents: preview.discounts?.subtotalCents ?? 0,
              totalDiscountCents: preview.discounts?.totalDiscountCents ?? 0,
              totalCents: preview.discounts?.totalCents ?? 0,
            },
          }),
        ],
      )
    } catch (error) {
      console.warn('[scheduling] persist signup pricing snapshot:', error?.message ?? error)
    }
  }
}

/**
 * Order-level promo codes must survive after checkout. Persisting the selected
 * rule on each recurring signup lets the existing-account pricing engine apply
 * it once across the household, then select later post-discount spend tiers.
 */
async function persistRecurringOrderPromoAssignment(pool, preview, signups) {
  const promoRuleIds = [...new Set(
    (preview?.discounts?.orderDiscounts ?? [])
      .filter((discount) => discount.type === 'promo_code' && discount.ruleId != null)
      .map((discount) => Number(discount.ruleId))
      .filter(Number.isFinite),
  )]
  if (promoRuleIds.length === 0) return 0

  const rules = await pool.query(
    `SELECT id, name, amount_type, amount_value
     FROM discount_rule
     WHERE id = ANY($1::bigint[]) AND type = 'promo_code'
     ORDER BY priority, id`,
    [promoRuleIds],
  )
  const rule = rules.rows[0]
  if (!rule) return 0
  if (rules.rows.length > 1) {
    console.warn('[scheduling] multiple order-level promos resolved; persisting the highest-priority rule only')
  }
  const manualDiscountCents =
    rule.amount_type === 'fixed'
      ? Math.max(0, Math.round(Number(rule.amount_value)))
      : null
  const manualDiscountPct =
    rule.amount_type === 'percent'
      ? Math.max(0, Math.min(100, Number(rule.amount_value) / 100))
      : null
  if (manualDiscountCents == null && manualDiscountPct == null) return 0

  let updated = 0
  for (const signup of signups) {
    const slotKey = `${signup.formId}:${signup.slotGroupId}:${signup.timeSlotId ?? 'none'}`
    const signupItem = (preview.newSignups ?? []).find((item) => item.slotKey === slotKey)
    if (signupItem?.billingType === 'one_time' || signupItem?.multiClassPassApplied) continue
    const result = await pool.query(
      `UPDATE scheduling_signup
       SET manual_discount_cents = $2,
           manual_discount_pct = $3,
           manual_discount_reason = $4,
           manual_discount_rule_id = $5
       WHERE id = $1
         AND (
           (manual_discount_cents IS NULL AND manual_discount_pct IS NULL AND manual_discount_rule_id IS NULL)
           OR manual_discount_rule_id = $5
         )
       RETURNING id`,
      [signup.signupId, manualDiscountCents, manualDiscountPct, rule.name, Number(rule.id)],
    )
    updated += result.rows.length
  }
  return updated
}

/**
 * @param {import('pg').Pool} pool
 * @param {object} args
 * @param {number} args.memberId enrolled athlete
 * @param {Array<{signupId:number, formId:number, slotGroupId:number, timeSlotId:number, formTitle:string, slotLabel:string}>} args.signups
 * @param {object|null} args.preview full order preview built at batch time
 */
export async function persistSignupCharges(pool, {
  memberId,
  signups = [],
  preview = null,
  stripeCheckoutSessionId = null,
  purchasedAt = null,
}) {
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

  const account = await loadOrCreateUnassignedBillingAccount(pool, familyId)
  if (!account) return { charges: 0, subscriptions: 0 }

  await persistSignupPricingSnapshots(pool, preview, signups)
  try {
    await persistRecurringOrderPromoAssignment(pool, preview, signups)
  } catch (error) {
    console.warn('[scheduling] persist recurring order promo:', error?.message ?? error)
  }

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
          fromDate: fm?.enrollmentStartDate
            ? new Date(`${fm.enrollmentStartDate}T12:00:00Z`)
            : new Date(),
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
           service_period_start, service_period_end, stripe_checkout_session_id)
        VALUES ($1, $2, 'scheduling_signup', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
        stripeCheckoutSessionId,
      ],
    )
    requireCheckoutChargeBinding(result, {
      stripeCheckoutSessionId,
      accountId: account.id,
      memberId,
      amountCents: chargeNet,
      label: `Enrollment charge ${signup.signupId}`,
    })
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
      const orderCredit = await pool.query(
        `
          INSERT INTO billing_charge
            (family_billing_account_id, member_id, source_type, source_id, description,
             amount_cents, gross_amount_cents, discount_amount_cents,
             charge_type, billing_interval, stripe_checkout_session_id)
          VALUES ($1, $2, 'order_discount', $3, 'Order discount', $4, $5, 0, 'credit', 'one_time', $6)
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
          account.id,
          memberId,
          String(firstSignupId),
          -orderDiscountCents,
          -orderDiscountCents,
          stripeCheckoutSessionId,
        ],
      )
      requireCheckoutChargeBinding(orderCredit, {
        stripeCheckoutSessionId,
        accountId: account.id,
        memberId,
        amountCents: -orderDiscountCents,
        label: `Enrollment order credit ${firstSignupId}`,
      })
    } catch (err) {
      if (err?.code === 'PAID_CHECKOUT_CHARGE_BINDING_CONFLICT') throw err
      console.warn('[scheduling] persistSignupCharges order discount:', err.message)
    }
  }

  const feeItems = preview?.additionalFees?.enabled ? preview.additionalFees.items || [] : []
  const parsedPurchasedAt = purchasedAt instanceof Date ? purchasedAt : new Date(purchasedAt ?? Date.now())
  const effectivePurchasedAt = Number.isFinite(parsedPurchasedAt.getTime())
    ? parsedPurchasedAt
    : new Date()
  const renewsOn = membershipRenewsOnFromPurchase(effectivePurchasedAt)
  const renewsOnKey = toUtcDateString(renewsOn) || toUtcDateString(effectivePurchasedAt)
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

    let feeChargeId = null
    try {
      const feeCharge = await pool.query(
        `
          INSERT INTO billing_charge
            (family_billing_account_id, member_id, source_type, source_id, description,
             amount_cents, gross_amount_cents, discount_amount_cents,
             charge_type, billing_interval, metadata, stripe_checkout_session_id)
          VALUES ($1, $2, 'additional_fee', $3, $4, $5, $6, $7, 'one_time', 'one_time',
            jsonb_strip_nulls(jsonb_build_object('discountCode', NULLIF($8, ''))), $9)
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
          account.id,
          memberId,
          sourceId,
          fee.name || 'Additional fee',
          feeAmount,
          feeGross,
          feeDiscount,
          fee.promoRuleId != null && feeDiscount > 0 ? fee.promoCode ?? null : null,
          stripeCheckoutSessionId,
        ],
      )
      requireCheckoutChargeBinding(feeCharge, {
        stripeCheckoutSessionId,
        accountId: account.id,
        memberId,
        amountCents: feeAmount,
        label: `Enrollment additional fee ${sourceId}`,
      })
      if (feeCharge.rows.length > 0) {
        charges += 1
        feeChargeId = Number(feeCharge.rows[0].id)
      } else {
        feeChargeId = await pool.query(
          `SELECT id FROM billing_charge WHERE source_type = 'additional_fee' AND source_id = $1 LIMIT 1`,
          [sourceId],
        ).then((result) => Number(result.rows[0]?.id) || null)
      }
    } catch (err) {
      if (err?.code === 'PAID_CHECKOUT_CHARGE_BINDING_CONFLICT') throw err
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

    // Paid memberships are activated by the canonical payment allocator. A
    // fully waived membership has no payment to allocate, so it is satisfied
    // immediately for the enrolled athlete.
    if (!isAnnualMembership || feeAmount > 0) continue
    try {
      await pool.query(
        `INSERT INTO additional_fee_redemption
           (fee_id, member_id, signup_id, period_key, amount_cents, billing_charge_id, satisfied_at, created_at)
         VALUES ($1, $2, $3, $4, 0, $5, $6, $6)
         ON CONFLICT (fee_id, member_id, period_key) DO NOTHING`,
        [fee.feeId, memberId, firstSignupId, renewsOnKey, feeChargeId, effectivePurchasedAt],
      )
    } catch (err) {
      console.warn('[scheduling] persistSignupCharges waived fee redemption:', err.message)
    }
  }

  return { charges, subscriptions }
}

export { ensureBillingAccount, cancelSubscriptionsForSource }
