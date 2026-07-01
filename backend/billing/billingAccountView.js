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

function mapRefund(row) {
  return {
    id: Number(row.id),
    paymentId: row.payment_id != null ? Number(row.payment_id) : null,
    amountCents: Number(row.amount_cents ?? 0),
    reason: row.reason ?? null,
    externalReference: row.external_reference ?? null,
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

/**
 * @param {import('pg').Pool} pool
 * @param {{ id:number, family_id:number }} account family_billing_account row
 * @param {{ memberScopeId?: number|null }} [options]
 */
export async function buildBillingAccountView(pool, account, { memberScopeId = null } = {}) {
  const familyScope = memberScopeId == null

  // Charges (member-filtered for non-payer member view).
  const chargeParams = [account.id]
  let chargeFilter = ''
  if (!familyScope) {
    chargeParams.push(memberScopeId)
    chargeFilter = ` AND c.member_id = $${chargeParams.length}`
  }
  const chargesRes = await pool.query(
    `
      SELECT c.*, TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS member_name
      FROM billing_charge c
      LEFT JOIN member m ON m.id = c.member_id
      WHERE c.family_billing_account_id = $1 ${chargeFilter}
      ORDER BY c.created_at DESC, c.id DESC
    `,
    chargeParams,
  )

  // Active recurring subscriptions (source of truth for monthly total).
  const subParams = [account.id]
  let subFilter = ''
  if (!familyScope) {
    subParams.push(memberScopeId)
    subFilter = ` AND s.member_id = $${subParams.length}`
  }
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
  const subscriptions = subsRes.rows.map(mapSubscription)
  const activeSubs = subscriptions.filter((s) => s.status === 'active')
  const monthlyTotals = activeSubs.reduce(
    (acc, s) => {
      acc.grossCents += s.monthlyAmountCents
      acc.discountCents += s.discountAmountCents
      acc.netCents += s.netMonthlyCents
      return acc
    },
    { grossCents: 0, discountCents: 0, netCents: 0 },
  )

  // Payments + refunds are family-wide (only for payer / family scope).
  let payments = []
  let refunds = []
  let ledger = []
  let paymentsCents = 0
  let refundsCents = 0
  if (familyScope) {
    const paymentsRes = await pool.query(
      `SELECT * FROM billing_payment WHERE family_billing_account_id = $1 ORDER BY paid_at DESC, id DESC`,
      [account.id],
    )
    payments = paymentsRes.rows
    paymentsCents = payments.reduce((sum, p) => sum + Number(p.amount_cents ?? 0), 0)

    const refundsRes = await pool.query(
      `SELECT * FROM billing_refund WHERE family_billing_account_id = $1 ORDER BY created_at DESC, id DESC`,
      [account.id],
    )
    refunds = refundsRes.rows.map(mapRefund)
    refundsCents = refunds.reduce((sum, r) => sum + r.amountCents, 0)

    const ledgerRes = await pool.query(
      `SELECT * FROM v_account_ledger WHERE family_billing_account_id = $1 ORDER BY occurred_at DESC, entry_kind DESC, ref_id DESC LIMIT 500`,
      [account.id],
    )
    ledger = ledgerRes.rows.map(mapLedgerRow)
  }

  const charges = chargesRes.rows
  const chargesCents = charges.reduce((sum, c) => sum + Number(c.amount_cents ?? 0), 0)
  const balanceCents = chargesCents - paymentsCents + refundsCents

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

  return {
    charges,
    subscriptions,
    monthlyTotals,
    payments,
    paymentsCents,
    refunds,
    refundsCents,
    ledger,
    chargesCents,
    balanceCents,
    bundlePasses,
    bundleUsage,
  }
}
