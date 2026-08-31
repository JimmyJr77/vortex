/**
 * Statement-style billing account view (Billing Overhaul Phase 2c/3/4).
 *
 * Builds a single rich object from persisted records — never frontend math — for both
 * admin and member portals: recurring subscription itemization + monthly totals,
 * one-time vs recurring charge separation, unified ledger (v_account_ledger), refunds,
 * bundle balances + usage history, and account totals (charges − payments + refunds).
 *
 * Pass `memberScopeId` to restrict to a single member (member portal, non-payer view):
 * charges/subscriptions/bundles are filtered to that member and family-wide
 * payments/refunds/ledger are omitted.
 */

import { loadPassUsageHistory } from '../programs/multiClassPass.js'
import { buildBillingHistory, buildCurrentPeriod } from './billingPeriodView.js'
import { buildRecurringBreakpoints } from './recurringPeriodPricing.js'
import { reconcileEnrollmentLedger } from './enrollmentLedgerReconcile.js'
import { isGenericCardMethod } from './paymentMethodLabel.js'
import {
  ANNUAL_MEMBERSHIP_PRICING_KEY,
  ANNUAL_MEMBERSHIP_SOURCE_TYPE,
  isMembershipValidThrough,
  membershipRenewsOnFromPurchase,
  toUtcDateString,
} from '../scheduling/membershipAnniversary.js'

function isAnnualMembershipSubscription(sub) {
  return (
    sub.sourceType === ANNUAL_MEMBERSHIP_SOURCE_TYPE ||
    sub.source_type === ANNUAL_MEMBERSHIP_SOURCE_TYPE ||
    sub.pricingOptionKey === ANNUAL_MEMBERSHIP_PRICING_KEY ||
    sub.pricing_option_key === ANNUAL_MEMBERSHIP_PRICING_KEY
  )
}

/** Earliest upcoming annual membership renew date for the scoped account. */
export function resolveMembershipRenewsOn({
  subscriptions = [],
  redemptions = [],
  asOf = new Date(),
} = {}) {
  const dates = []

  for (const sub of subscriptions) {
    if (!isAnnualMembershipSubscription(sub)) continue
    const status = sub.status ?? 'active'
    if (status !== 'active' && status !== 'paused') continue
    const next = sub.nextBillDate ?? sub.next_bill_date
    if (!next) continue
    const d = next instanceof Date ? next : new Date(`${String(next).slice(0, 10)}T00:00:00Z`)
    if (!Number.isNaN(d.getTime()) && d.getTime() > asOf.getTime()) {
      dates.push(d)
    }
  }

  for (const row of redemptions) {
    const endedAt = row.ended_at ?? row.endedAt
    if (endedAt && new Date(endedAt).getTime() <= asOf.getTime()) continue
    const satisfiedAt = row.satisfied_at ?? row.satisfiedAt ?? row.created_at ?? row.createdAt
    if (!isMembershipValidThrough(satisfiedAt, asOf)) continue
    const renews = membershipRenewsOnFromPurchase(satisfiedAt)
    if (renews) dates.push(renews)
  }

  if (dates.length === 0) return null
  dates.sort((a, b) => a.getTime() - b.getTime())
  return toUtcDateString(dates[0])
}

function mapSubscription(row) {
  return {
    id: Number(row.id),
    memberId: row.member_id != null ? Number(row.member_id) : null,
    memberName: row.member_name ?? null,
    description: row.description,
    monthlyAmountCents: Number(row.monthly_amount_cents ?? 0),
    discountAmountCents: Number(row.discount_amount_cents ?? 0),
    netMonthlyCents: Number(row.net_monthly_cents ?? 0),
    status: row.status,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    nextBillDate: row.next_bill_date ?? null,
    pricingOptionKey: row.pricing_option_key ?? null,
    sourceType: row.source_type ?? null,
    sourceId: row.source_id ?? null,
  }
}

function mapLedgerRow(row) {
  return {
    entryKind: row.entry_kind,
    entryType: row.entry_type,
    refId: row.ref_id != null ? Number(row.ref_id) : null,
    memberId: row.member_id != null ? Number(row.member_id) : null,
    description: row.description,
    amountCents: Number(row.amount_cents ?? 0),
    occurredAt: row.occurred_at,
    runningBalanceCents: Number(row.running_balance_cents ?? 0),
  }
}

function toBillingMonthKey(value) {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 7)
  }
  const text = String(value)
  const directMonth = text.match(/^(\d{4}-\d{2})/)
  if (directMonth) return directMonth[1]
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 7)
}

function chargeServiceMonth(charge) {
  return toBillingMonthKey(charge.service_period_start ?? charge.created_at)
}

/**
 * Split the account ledger into the three cards that explain the balance:
 * open non-monthly/past-due charges + this recurring billing period - credits.
 * A settled refund is a household amount still owed, so it joins the open side.
 */
export function summarizeCustomerBalanceCards({
  charges = [],
  payments = [],
  subscriptions = [],
  refundsCents = 0,
  recurringBillingMonth = null,
} = {}) {
  let outstandingChargesCents = Math.max(0, Number(refundsCents) || 0)
  let ledgerCreditCents = 0
  let prepaidRecurringCents = 0

  const activeRecurringSubscriptions = subscriptions.filter((subscription) => (
    subscription.status === 'active' && !isAnnualMembershipSubscription(subscription)
  ))
  // The monthly card describes the tuition due for the upcoming billing month,
  // not merely the portion of that tuition that remains unpaid in the ledger.
  // That makes a pre-paid enrollment visible as recurring tuition plus a future
  // credit, instead of making the recurring card disappear.
  let monthlyRecurringCents = activeRecurringSubscriptions.reduce(
    (sum, subscription) => sum + Math.max(0, Number(
      subscription.netMonthlyCents ?? subscription.net_monthly_cents ?? 0,
    )),
    0,
  )
  let monthlyRecurringDiscountCents = activeRecurringSubscriptions.reduce(
    (sum, subscription) => sum + Math.max(0, Number(
      subscription.discountAmountCents ?? subscription.discount_amount_cents ?? 0,
    )),
    0,
  )

  const visibleCharges = charges.filter((charge) => (
    charge.metadata?.customerAuditVisibility !== 'suppressed'
  ))
  const chargesById = new Map(visibleCharges.map((charge) => [Number(charge.id), charge]))
  const linkedCreditOffsets = new Map()
  const linkedCreditRemainders = new Map()
  for (const credit of visibleCharges) {
    const creditAmount = Number(credit.amount_cents ?? 0)
    const relatedChargeId = Number(credit.related_charge_id ?? credit.relatedChargeId ?? 0)
    const relatedCharge = chargesById.get(relatedChargeId)
    if (creditAmount >= 0 || !relatedCharge || Number(relatedCharge.amount_cents ?? 0) <= 0) continue
    const targetRemaining = Math.max(0, Number(
      relatedCharge.remaining_amount_cents ?? relatedCharge.amount_cents ?? 0,
    ) - (linkedCreditOffsets.get(relatedChargeId) ?? 0))
    const offset = Math.min(Math.abs(creditAmount), targetRemaining)
    linkedCreditOffsets.set(relatedChargeId, (linkedCreditOffsets.get(relatedChargeId) ?? 0) + offset)
    linkedCreditRemainders.set(Number(credit.id), Math.abs(creditAmount) - offset)
  }

  for (const charge of visibleCharges) {
    const amount = Number(charge.amount_cents ?? 0)
    if (amount < 0) {
      ledgerCreditCents += linkedCreditRemainders.get(Number(charge.id)) ?? Math.abs(amount)
      continue
    }
    if (amount <= 0) continue
    const remaining = Math.max(0, Number(charge.remaining_amount_cents ?? amount)
      - (linkedCreditOffsets.get(Number(charge.id)) ?? 0))
    const isCurrentRecurring = charge.charge_type === 'recurring'
      && recurringBillingMonth != null
      && chargeServiceMonth(charge) === recurringBillingMonth
    if (isCurrentRecurring) {
      // A payment made before the next monthly collection is a credit against
      // that month. It remains visible as such even when the exact charge was
      // already created and linked to the payment.
      prepaidRecurringCents += Math.min(
        amount,
        Math.max(0, Number(charge.applied_amount_cents ?? amount - remaining)),
      )
      // A local recurring charge can exist before its subscription snapshot is
      // available. Use it as a fallback so the card still has a monthly total.
      if (activeRecurringSubscriptions.length === 0) {
        monthlyRecurringCents += amount
        monthlyRecurringDiscountCents += Math.max(0, Number(charge.discount_amount_cents ?? 0))
      }
      continue
    }
    if (remaining) outstandingChargesCents += remaining
  }

  const unappliedPaymentCents = payments.reduce(
    (sum, payment) => sum + Math.max(0, Number(payment.remaining_amount_cents ?? 0)),
    0,
  )
  return {
    outstandingBalanceCents: outstandingChargesCents,
    monthlyRecurringCents,
    monthlyRecurringDiscountCents,
    futureCreditsCents: ledgerCreditCents + unappliedPaymentCents + prepaidRecurringCents,
  }
}

function mapRefund(row) {
  return {
    id: Number(row.id),
    paymentId: row.payment_id != null ? Number(row.payment_id) : null,
    amountCents: Number(row.amount_cents ?? 0),
    reason: row.reason ?? null,
    externalReference: row.external_reference ?? null,
    stripeRefundId: row.stripe_refund_id ?? null,
    externalStatus: row.external_status ?? 'succeeded',
    errorMessage: row.error_message ?? null,
    createdAt: row.created_at,
  }
}

function mapBundle(row) {
  return {
    id: Number(row.id),
    memberId: Number(row.member_id),
    memberName: row.member_name ?? null,
    programsId: Number(row.programs_id),
    packageId: row.package_id,
    packageLabel: row.package_label ?? null,
    classCountPurchased: Number(row.class_count_purchased ?? 0),
    classesRemaining: Number(row.classes_remaining ?? 0),
    priceCents: Number(row.price_cents ?? 0),
    status: row.status ?? 'active',
    expiresAt: row.expires_at ?? null,
    purchasedAt: row.purchased_at ?? null,
  }
}

function logBillingQueryError(label, err) {
  const code = err?.code ?? 'unknown'
  const message = err?.message ?? String(err)
  console.error(`[billingAccountView] ${label} failed (${code}):`, message)
}

/**
 * Build ledger rows from charges/payments/refunds when v_account_ledger is unavailable.
 * Sign convention matches migration 053: charges +, payments −, refunds +.
 */
export function buildLedgerFallback({ charges = [], payments = [], refunds = [] }) {
  const entries = []

  for (const c of charges) {
    entries.push({
      entry_kind: 'charge',
      entry_type: c.charge_type ?? 'one_time',
      ref_id: c.id,
      member_id: c.member_id ?? null,
      description: c.description,
      amount_cents: Number(c.amount_cents ?? 0),
      occurred_at: c.created_at,
    })
  }
  for (const p of payments) {
    entries.push({
      entry_kind: 'payment',
      entry_type: 'payment',
      ref_id: p.id,
      member_id: null,
      description: (() => {
        const raw = p.method?.trim() || ''
        if (!raw || isGenericCardMethod(raw)) return 'Card'
        return raw
      })(),
      amount_cents: -Number(p.amount_cents ?? 0),
      occurred_at: p.paid_at,
    })
  }
  for (const r of refunds) {
    const mapped = typeof r.amountCents === 'number' ? r : mapRefund(r)
    if (mapped.externalStatus && mapped.externalStatus !== 'succeeded') continue
    entries.push({
      entry_kind: 'refund',
      entry_type: 'refund',
      ref_id: mapped.id,
      member_id: null,
      description: mapped.reason?.trim() ? mapped.reason : 'Refund',
      amount_cents: mapped.amountCents,
      occurred_at: mapped.createdAt ?? r.created_at,
    })
  }

  entries.sort((a, b) => {
    const ta = new Date(a.occurred_at).getTime()
    const tb = new Date(b.occurred_at).getTime()
    if (ta !== tb) return ta - tb
    if (a.entry_kind !== b.entry_kind) return a.entry_kind.localeCompare(b.entry_kind)
    return Number(a.ref_id) - Number(b.ref_id)
  })

  let running = 0
  const withBalance = entries.map((e) => {
    running += e.amount_cents
    return { ...e, running_balance_cents: running }
  })

  withBalance.reverse()
  return withBalance.slice(0, 500).map(mapLedgerRow)
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ id:number, family_id:number }} account family_billing_account row
 * @param {{ memberScopeId?: number|null }} [options]
 */
export async function buildBillingAccountView(pool, account, { memberScopeId = null } = {}) {
  const familyScope = memberScopeId == null

  if (familyScope) {
    try {
      await reconcileEnrollmentLedger(pool, account)
    } catch (err) {
      console.error('[billingAccountView] reconcileEnrollmentLedger:', err?.message ?? err, err?.code)
    }
  }

  // Charges (member-filtered for non-payer member view).
  const chargeParams = [account.id]
  let chargeFilter = ''
  if (!familyScope) {
    chargeParams.push(memberScopeId)
    chargeFilter = ` AND c.member_id = $${chargeParams.length}`
  }
  const chargesRes = await pool.query(
    `
      SELECT c.*, TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS member_name,
             COALESCE(app.applied_cents, 0)::int AS applied_amount_cents,
             GREATEST(0, c.amount_cents - COALESCE(app.applied_cents, 0))::int AS remaining_amount_cents,
             app.items AS payment_applications
      FROM billing_charge c
      LEFT JOIN member m ON m.id = c.member_id
      LEFT JOIN LATERAL (
        SELECT
          SUM(effective.amount_cents)::int AS applied_cents,
          jsonb_agg(jsonb_build_object(
            'paymentId', effective.payment_id,
            'amountCents', effective.amount_cents,
            'paidAt', effective.paid_at,
            'method', effective.method,
            'allocationReason', effective.allocation_reason
          ) ORDER BY effective.paid_at, effective.payment_id) AS items
        FROM (
          SELECT application.billing_payment_id AS payment_id, payment.paid_at, payment.method,
                 MAX(application.allocation_reason) FILTER (WHERE application.application_kind = 'application') AS allocation_reason,
                 SUM(CASE WHEN application.application_kind = 'reversal' THEN -application.amount_cents ELSE application.amount_cents END)::int AS amount_cents
          FROM billing_payment_application application
          JOIN billing_payment payment ON payment.id = application.billing_payment_id
          WHERE application.billing_charge_id = c.id
          GROUP BY application.billing_payment_id, payment.paid_at, payment.method
          HAVING SUM(CASE WHEN application.application_kind = 'reversal' THEN -application.amount_cents ELSE application.amount_cents END) <> 0
        ) effective
      ) app ON TRUE
      WHERE c.family_billing_account_id = $1 ${chargeFilter}
      ORDER BY c.created_at DESC, c.id DESC
    `,
    chargeParams,
  )
  const charges = chargesRes.rows
  const chargesCents = charges.reduce((sum, c) => sum + Number(c.amount_cents ?? 0), 0)

  const subParams = [account.id]
  let subFilter = ''
  if (!familyScope) {
    subParams.push(memberScopeId)
    subFilter = ` AND s.member_id = $${subParams.length}`
  }

  let subscriptions = []
  let rawSubscriptions = []
  let subscriptionHistory = []
  try {
    const subsRes = await pool.query(
      `
        SELECT s.*, TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS member_name
        FROM billing_subscription s
        LEFT JOIN member m ON m.id = s.member_id
        WHERE s.family_billing_account_id = $1 AND s.status <> 'cancelled' ${subFilter}
        ORDER BY s.status, s.created_at
      `,
      subParams,
    )
    rawSubscriptions = subsRes.rows
    subscriptions = rawSubscriptions.map(mapSubscription)

    const historyRes = await pool.query(
      `
        SELECT s.*, TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS member_name
        FROM billing_subscription s
        LEFT JOIN member m ON m.id = s.member_id
        WHERE s.family_billing_account_id = $1 AND s.status = 'cancelled' ${subFilter}
        ORDER BY s.end_date DESC NULLS LAST, s.updated_at DESC, s.id DESC
      `,
      subParams,
    )
    subscriptionHistory = historyRes.rows.map(mapSubscription)
  } catch (err) {
    logBillingQueryError('subscriptions', err)
    subscriptions = []
    rawSubscriptions = []
    subscriptionHistory = []
  }

  let recurringBreakpoints = []
  try {
    recurringBreakpoints = await buildRecurringBreakpoints(pool, {
      familyId: account.family_id,
      subscriptions: rawSubscriptions,
      charges,
    })
  } catch (err) {
    console.warn('[billingAccountView] recurring breakpoints:', err?.message ?? err)
  }
  const today = new Date()
  const currentPricingKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const nextRecurringBillKey = subscriptions
    .filter((subscription) => subscription.status === 'active' && subscription.nextBillDate)
    .map((subscription) => toBillingMonthKey(subscription.nextBillDate))
    .filter(Boolean)
    .sort()[0]
  const recurringPricingKey = nextRecurringBillKey && nextRecurringBillKey > currentPricingKey
    ? nextRecurringBillKey
    : currentPricingKey
  const currentResolvedPricing = recurringBreakpoints
    .filter((item) => item.periodKey <= recurringPricingKey)
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey))
    .at(-1)
  if (currentResolvedPricing) {
    const bySubscription = new Map(
      currentResolvedPricing.lines.map((line) => [Number(line.subscriptionId), line]),
    )
    subscriptions = subscriptions.map((subscription) => {
      const line = bySubscription.get(Number(subscription.id))
      return line ? {
        ...subscription,
        monthlyAmountCents: line.grossCents,
        discountAmountCents: line.discountCents,
        netMonthlyCents: line.netCents,
        discountComponents: line.discountComponents ?? [],
      } : subscription
    })
  }
  const activeSubs = subscriptions.filter((s) => s.status === 'active' && !isAnnualMembershipSubscription(s))
  const monthlyTotals = activeSubs.reduce(
    (acc, s) => {
      acc.grossCents += s.monthlyAmountCents
      acc.discountCents += s.discountAmountCents
      acc.netCents += s.netMonthlyCents
      return acc
    },
    { grossCents: 0, discountCents: 0, netCents: 0 },
  )

  let membershipRedemptions = []
  try {
    const redemptionParams = [account.family_id]
    let redemptionMemberFilter = ''
    if (!familyScope) {
      redemptionParams.push(memberScopeId)
      redemptionMemberFilter = ` AND r.member_id = $${redemptionParams.length}`
    }
    const redemptionRes = await pool.query(
      `
        SELECT r.fee_id, r.member_id, r.period_key, r.created_at, r.amount_cents,
               r.satisfied_at, r.ended_at, r.end_reason, r.billing_charge_id
        FROM additional_fee_redemption r
        JOIN member m ON m.id = r.member_id
        WHERE m.family_id = $1 ${redemptionMemberFilter}
        ORDER BY r.created_at DESC
      `,
      redemptionParams,
    )
    membershipRedemptions = redemptionRes.rows
  } catch (err) {
    logBillingQueryError('additional_fee_redemption', err)
    membershipRedemptions = []
  }

  const membershipRenewsOn = resolveMembershipRenewsOn({
    subscriptions,
    redemptions: membershipRedemptions,
  })
  const hasActiveMembership = Boolean(membershipRenewsOn)

  // Payments + refunds are family-wide (only for payer / family scope).
  let payments = []
  let refunds = []
  let ledger = []
  let paymentsCents = 0
  let refundsCents = 0
  if (familyScope) {
    try {
      const paymentsRes = await pool.query(
        `SELECT payment.*,
                COALESCE(app.applied_cents, 0)::int AS applied_amount_cents,
                GREATEST(0, payment.amount_cents - COALESCE(app.applied_cents, 0) - COALESCE(refunds.refunded_cents, 0))::int AS remaining_amount_cents,
                app.items AS charge_applications
         FROM billing_payment payment
         LEFT JOIN LATERAL (
           SELECT
             SUM(effective.amount_cents)::int AS applied_cents,
             jsonb_agg(jsonb_build_object(
               'chargeId', effective.charge_id,
               'description', effective.description,
               'memberId', effective.member_id,
               'amountCents', effective.amount_cents,
               'allocationReason', effective.allocation_reason
             ) ORDER BY effective.charge_id) AS items
           FROM (
             SELECT application.billing_charge_id AS charge_id,
                    charge.description, charge.member_id,
                    MAX(application.allocation_reason) FILTER (WHERE application.application_kind = 'application') AS allocation_reason,
                    SUM(CASE WHEN application.application_kind = 'reversal' THEN -application.amount_cents ELSE application.amount_cents END)::int AS amount_cents
             FROM billing_payment_application application
             JOIN billing_charge charge ON charge.id = application.billing_charge_id
             WHERE application.billing_payment_id = payment.id
             GROUP BY application.billing_charge_id, charge.description, charge.member_id
             HAVING SUM(CASE WHEN application.application_kind = 'reversal' THEN -application.amount_cents ELSE application.amount_cents END) <> 0
           ) effective
         ) app ON TRUE
         LEFT JOIN LATERAL (
           SELECT SUM(refund.amount_cents)::int AS refunded_cents
           FROM billing_refund refund
           WHERE refund.payment_id = payment.id
             AND COALESCE(refund.external_status, 'succeeded') IN ('pending', 'succeeded')
         ) refunds ON TRUE
         WHERE payment.family_billing_account_id = $1
         ORDER BY payment.paid_at DESC, payment.id DESC`,
        [account.id],
      )
      payments = paymentsRes.rows
      paymentsCents = payments.reduce((sum, p) => sum + Number(p.amount_cents ?? 0), 0)
    } catch (err) {
      logBillingQueryError('payments', err)
      payments = []
      paymentsCents = 0
    }

    try {
      const refundsRes = await pool.query(
        `SELECT * FROM billing_refund WHERE family_billing_account_id = $1 ORDER BY created_at DESC, id DESC`,
        [account.id],
      )
      refunds = refundsRes.rows.map(mapRefund)
      refundsCents = refunds
        .filter((refund) => refund.externalStatus === 'succeeded')
        .reduce((sum, refund) => sum + refund.amountCents, 0)
    } catch (err) {
      logBillingQueryError('refunds', err)
      refunds = []
      refundsCents = 0
    }

    try {
      const ledgerRes = await pool.query(
        `SELECT * FROM v_account_ledger WHERE family_billing_account_id = $1 ORDER BY occurred_at DESC, entry_kind DESC, ref_id DESC LIMIT 500`,
        [account.id],
      )
      ledger = ledgerRes.rows.map(mapLedgerRow)
    } catch (err) {
      logBillingQueryError('v_account_ledger', err)
      ledger = buildLedgerFallback({ charges, payments, refunds })
    }
  }

  const balanceCents = chargesCents - paymentsCents + refundsCents
  const currentMonthKey = new Date().toISOString().slice(0, 7)
  const balanceCards = summarizeCustomerBalanceCards({
    charges,
    payments,
    subscriptions,
    refundsCents,
    recurringBillingMonth: nextRecurringBillKey ?? currentMonthKey,
  })
  const {
    outstandingBalanceCents,
    monthlyRecurringCents,
    monthlyRecurringDiscountCents,
    futureCreditsCents,
  } = balanceCards
  const paidThisMonthCents = payments.reduce((sum, payment) => (
    String(payment.paid_at ?? '').slice(0, 7) === currentMonthKey
      ? sum + Math.max(0, Number(payment.amount_cents ?? 0))
      : sum
  ), 0)

  // Bundle balances + usage history for the scoped member(s).
  const bundleParams = [account.family_id]
  let bundleMemberFilter = ''
  if (!familyScope) {
    bundleParams.push(memberScopeId)
    bundleMemberFilter = ` AND p.member_id = $${bundleParams.length}`
  }
  let bundlePasses = []
  let bundleUsage = []
  try {
    const bundlesRes = await pool.query(
      `
        SELECT p.*, TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS member_name
        FROM member_multi_class_pass p
        JOIN member m ON m.id = p.member_id
        WHERE m.family_id = $1 ${bundleMemberFilter}
        ORDER BY p.purchased_at DESC, p.id DESC
      `,
      bundleParams,
    )
    bundlePasses = bundlesRes.rows.map(mapBundle)

    if (bundlePasses.length > 0) {
      if (familyScope) {
        const memberIds = [...new Set(bundlePasses.map((b) => b.memberId))]
        const usageAll = []
        for (const mid of memberIds) {
          const rows = await loadPassUsageHistory(pool, { memberId: mid, limit: 100 })
          usageAll.push(...rows)
        }
        bundleUsage = usageAll.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      } else {
        bundleUsage = await loadPassUsageHistory(pool, { memberId: memberScopeId, limit: 100 })
      }
    }
  } catch {
    // Bundle tables are lazily created; tolerate absence.
    bundlePasses = []
    bundleUsage = []
  }

  const currentPeriod = buildCurrentPeriod({
    charges,
    payments,
    subscriptions: subscriptions.filter((s) => !isAnnualMembershipSubscription(s)),
  })
  if (currentResolvedPricing) {
    const bySubscription = new Map(currentResolvedPricing.lines.map((line) => [Number(line.subscriptionId), line]))
    currentPeriod.recurringEnrollments = currentPeriod.recurringEnrollments.map((subscription) => {
      const line = bySubscription.get(Number(subscription.id))
      return line ? {
        ...subscription,
        monthlyAmountCents: line.grossCents,
        discountAmountCents: line.discountCents,
        netMonthlyCents: line.netCents,
      } : subscription
    })
  }

  return {
    charges,
    subscriptions: subscriptions.filter((s) => !isAnnualMembershipSubscription(s)),
    subscriptionHistory: subscriptionHistory.filter((s) => !isAnnualMembershipSubscription(s)),
    monthlyTotals,
    recurringBreakpoints,
    membershipRenewsOn,
    hasActiveMembership,
    payments,
    paymentsCents,
    refunds,
    refundsCents,
    ledger,
    chargesCents,
    balanceCents,
    outstandingBalanceCents,
    monthlyRecurringCents,
    monthlyRecurringDiscountCents,
    futureCreditsCents,
    paidThisMonthCents,
    bundlePasses,
    bundleUsage,
    currentPeriod,
    billingHistory: familyScope
      ? buildBillingHistory({ charges, payments, months: 12 })
      : buildBillingHistory({
          charges: charges.filter((c) => Number(c.member_id) === Number(memberScopeId)),
          payments: [],
          months: 12,
        }),
  }
}
