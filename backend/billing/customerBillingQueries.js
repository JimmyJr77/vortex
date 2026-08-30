import { buildBillingAccountView } from './billingAccountView.js'
import { getStripeClient, stripeEnabled } from './stripeBilling.js'
import { buildAdminMemberEnrollments } from '../scheduling/adminEnrollmentsView.js'
import {
  adjustmentCoversPeriod,
  applyEnrollmentPriceAdjustment,
  billingMonthKey,
  mapPriceAdjustment,
} from './customerBillingPricing.js'
import { mapBillingActivity } from './billingActivity.js'

export async function ensureCustomerBillingAccount(pool, familyId, facilityId = null) {
  const family = await pool.query(
    `SELECT * FROM family
     WHERE id = $1 AND ($2::bigint IS NULL OR facility_id = $2)`,
    [Number(familyId), facilityId],
  )
  if (!family.rows[0]) return null
  const existing = await pool.query(
    `SELECT * FROM family_billing_account WHERE family_id = $1`,
    [Number(familyId)],
  )
  if (existing.rows[0]) return { ...existing.rows[0], family_name: family.rows[0].family_name }
  const created = await pool.query(
    `INSERT INTO family_billing_account (
       family_id, payer_member_id, billing_email, billing_phone,
       billing_street, billing_city, billing_state, billing_zip
     )
     SELECT f.id, m.id, m.email, m.phone, m.billing_street,
            m.billing_city, m.billing_state, m.billing_zip
     FROM family f
     LEFT JOIN LATERAL (
       SELECT * FROM member
       WHERE family_id = f.id AND is_active = TRUE
       ORDER BY (email IS NULL), id LIMIT 1
     ) m ON TRUE
     WHERE f.id = $1
     ON CONFLICT (family_id) DO UPDATE SET updated_at = family_billing_account.updated_at
     RETURNING *`,
    [Number(familyId)],
  )
  return created.rows[0] ? { ...created.rows[0], family_name: family.rows[0].family_name } : null
}

export async function searchCustomerBilling(pool, { facilityId, query, limit = 50 }) {
  const value = String(query ?? '').trim()
  if (!value) return []
  const numericFamilyId = /^\d+$/.test(value) ? Number(value) : null
  const result = await pool.query(
    `SELECT DISTINCT
       f.id AS family_id,
       f.family_name,
       fba.id AS billing_account_id,
       m.id AS member_id,
       m.first_name,
       m.last_name,
       m.email,
       m.phone,
       m.is_active
     FROM family f
     JOIN member m ON (
       m.family_id = f.id OR EXISTS (
         SELECT 1 FROM family_member fm
         WHERE fm.family_id = f.id AND fm.member_id = m.id AND fm.is_active = TRUE
       )
     )
     LEFT JOIN family_billing_account fba ON fba.family_id = f.id AND fba.is_active = TRUE
     WHERE f.facility_id = $1
       AND (
         ($2::bigint IS NOT NULL AND f.id = $2)
         OR CONCAT_WS(' ', m.first_name, m.last_name) ILIKE $3
         OR COALESCE(m.email, '') ILIKE $3
         OR COALESCE(m.phone, '') ILIKE $3
         OR (
           regexp_replace($4, '\\D', '', 'g') <> ''
           AND regexp_replace(COALESCE(m.phone, ''), '\\D', '', 'g')
             LIKE '%' || regexp_replace($4, '\\D', '', 'g') || '%'
         )
       )
     ORDER BY m.is_active DESC, m.last_name, m.first_name, m.id
     LIMIT $5`,
    [facilityId, numericFamilyId, `%${value}%`, value, Math.min(100, Math.max(1, Number(limit) || 50))],
  )
  return result.rows.map((row) => ({
    familyId: Number(row.family_id),
    familyName: row.family_name,
    billingAccountId: row.billing_account_id == null ? null : Number(row.billing_account_id),
    memberId: Number(row.member_id),
    name: [row.first_name, row.last_name].filter(Boolean).join(' '),
    email: row.email ?? null,
    phone: row.phone ?? null,
    isActive: row.is_active !== false,
  }))
}

async function loadFamilyMembers(pool, familyId) {
  const result = await pool.query(
    `SELECT DISTINCT m.id, m.first_name, m.last_name, m.email, m.phone, m.is_active
     FROM member m
     WHERE m.family_id = $1 OR EXISTS (
       SELECT 1 FROM family_member fm
       WHERE fm.family_id = $1 AND fm.member_id = m.id AND fm.is_active = TRUE
     )
     ORDER BY m.is_active DESC, m.last_name, m.first_name, m.id`,
    [familyId],
  )
  return result.rows.map((row) => ({
    id: Number(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    name: [row.first_name, row.last_name].filter(Boolean).join(' '),
    email: row.email ?? null,
    phone: row.phone ?? null,
    isActive: row.is_active !== false,
  }))
}

export async function loadDefaultPaymentMethodSummary(account) {
  if (!account?.stripe_customer_id || !stripeEnabled()) {
    return { available: false, stripeEnabled: stripeEnabled(), paymentMethod: null }
  }
  try {
    const stripe = await getStripeClient()
    if (!stripe) return { available: false, stripeEnabled: true, paymentMethod: null }
    const customer = await stripe.customers.retrieve(account.stripe_customer_id, {
      expand: ['invoice_settings.default_payment_method'],
    })
    if (!customer || customer.deleted) return { available: false, stripeEnabled: true, paymentMethod: null }
    let paymentMethod = customer.invoice_settings?.default_payment_method ?? null
    if (typeof paymentMethod === 'string') paymentMethod = await stripe.paymentMethods.retrieve(paymentMethod)
    if (!paymentMethod) {
      const methods = await stripe.paymentMethods.list({ customer: customer.id, type: 'card', limit: 1 })
      paymentMethod = methods.data?.[0] ?? null
    }
    const card = paymentMethod?.card
    return {
      available: Boolean(paymentMethod?.id),
      stripeEnabled: true,
      paymentMethod: paymentMethod?.id
        ? {
            id: paymentMethod.id,
            brand: card?.brand ?? paymentMethod.type ?? 'card',
            last4: card?.last4 ?? null,
            expMonth: card?.exp_month ?? null,
            expYear: card?.exp_year ?? null,
          }
        : null,
    }
  } catch (error) {
    return {
      available: false,
      stripeEnabled: true,
      paymentMethod: null,
      error: error?.message ?? 'Unable to load saved payment method.',
    }
  }
}

function mapAccount(account) {
  return {
    id: Number(account.id),
    familyId: Number(account.family_id),
    familyName: account.family_name ?? null,
    payerMemberId: account.payer_member_id == null ? null : Number(account.payer_member_id),
    billingEmail: account.billing_email ?? null,
    billingPhone: account.billing_phone ?? null,
    billingStreet: account.billing_street ?? null,
    billingCity: account.billing_city ?? null,
    billingState: account.billing_state ?? null,
    billingZip: account.billing_zip ?? null,
    stripeCustomerId: account.stripe_customer_id ?? null,
    isActive: account.is_active !== false,
  }
}

function relevantEnrollment(row) {
  return ['confirmed', 'active', 'requested', 'paused', 'waitlisted'].includes(row.status)
}

function customerEnrollmentStatus(row) {
  if (row.status === 'requested') return 'pending_cancellation'
  const starts = String(row.enrollment_start_date ?? '').slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  if (['confirmed', 'active'].includes(row.status) && starts && starts > today) return 'scheduled'
  if (row.status === 'confirmed') return 'active'
  return row.status
}

/**
 * Return the first period-aware recurring-pricing line for every enrollment.
 * Current enrollments appear in the current breakpoint; scheduled enrollments
 * first appear in their activation month.
 */
export function firstRecurringPricingLineBySignup(breakpoints = []) {
  const bySignup = new Map()
  for (const breakpoint of breakpoints) {
    for (const line of breakpoint?.lines ?? []) {
      const signupId = Number(line.signupId)
      if (!Number.isFinite(signupId) || bySignup.has(signupId)) continue
      bySignup.set(signupId, line)
    }
  }
  return bySignup
}

export async function buildCustomerBillingOverview(pool, {
  familyId,
  facilityId,
  selectedMemberId = null,
}) {
  const account = await ensureCustomerBillingAccount(pool, familyId, facilityId)
  if (!account) return null
  const members = await loadFamilyMembers(pool, familyId)
  if (selectedMemberId != null && !members.some((member) => member.id === Number(selectedMemberId))) {
    throw new Error('Selected member does not belong to this family.')
  }

  const [view, enrollmentGroups, rawSubscriptions, adjustmentsResult, alertsResult, paymentMethod] =
    await Promise.all([
      buildBillingAccountView(pool, account, { memberScopeId: null }),
      Promise.all(
        members.map(async (member) => ({
          member,
          ...(await buildAdminMemberEnrollments(pool, member.id)),
        })),
      ),
      pool.query(
        `SELECT bs.*, TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS member_name
         FROM billing_subscription bs
         LEFT JOIN member m ON m.id = bs.member_id
         WHERE bs.family_billing_account_id = $1 AND bs.status <> 'cancelled'
         ORDER BY bs.status, bs.created_at, bs.id`,
        [account.id],
      ),
      pool.query(
        `SELECT * FROM enrollment_price_adjustment
         WHERE family_billing_account_id = $1
         ORDER BY effective_from_month, created_at, id`,
        [account.id],
      ).catch((error) => {
        if (error?.code === '42P01') return { rows: [] }
        throw error
      }),
      pool.query(
        `SELECT * FROM stripe_billing_alert
         WHERE family_billing_account_id = $1 AND resolved_at IS NULL
         ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
                  created_at DESC`,
        [account.id],
      ).catch((error) => {
        if (error?.code === '42P01') return { rows: [] }
        throw error
      }),
      loadDefaultPaymentMethodSummary(account),
    ])

  const adjustments = adjustmentsResult.rows.map(mapPriceAdjustment)
  const adjustmentsBySignup = new Map()
  for (const adjustment of adjustments) {
    const list = adjustmentsBySignup.get(adjustment.signupId) ?? []
    list.push(adjustment)
    adjustmentsBySignup.set(adjustment.signupId, list)
  }
  const currentMonth = billingMonthKey(new Date())
  const currentPricing = view.recurringBreakpoints?.find((item) => item.periodKey === currentMonth)
  const currentPricingBySubscription = new Map(
    (currentPricing?.lines ?? []).map((line) => [Number(line.subscriptionId), line]),
  )
  const currentPricingBySignup = new Map(
    (currentPricing?.lines ?? [])
      .filter((line) => Number.isFinite(Number(line.signupId)))
      .map((line) => [Number(line.signupId), line]),
  )
  const effectivePricingBySignup = firstRecurringPricingLineBySignup(
    view.recurringBreakpoints ?? [],
  )
  const rawSubscriptionBySignup = new Map(
    rawSubscriptions.rows
      .filter((row) => row.source_type === 'scheduling_signup' && Number.isFinite(Number(row.source_id)))
      .map((row) => [Number(row.source_id), row]),
  )
  const enrollments = []
  const waitlists = []
  for (const group of enrollmentGroups) {
    for (const row of group.rows ?? []) {
      if (!relevantEnrollment(row)) continue
      const rowAdjustments = adjustmentsBySignup.get(Number(row.id)) ?? []
      const activeAdjustment = rowAdjustments.find(
        (adjustment) => adjustment.status === 'active' && adjustmentCoversPeriod(adjustment, currentMonth),
      ) ?? null
      const pricingLine =
        currentPricingBySignup.get(Number(row.id)) ??
        effectivePricingBySignup.get(Number(row.id))
      const grossCents = Number(pricingLine?.grossCents ?? row.class_cost_cents ?? 0)
      const automaticNetCents = Number(
        pricingLine?.automaticNetCents ?? row.adjusted_cost_cents ?? grossCents,
      )
      const resolved = row.status === 'paused'
        ? {
            grossCents,
            automaticNetCents: 0,
            automaticDiscountCents: grossCents,
            manualAdjustmentCents: 0,
            discountCents: grossCents,
            netCents: 0,
            discountComponents: [{ name: 'Paused — no recurring charge', amountCents: grossCents, source: 'pause' }],
          }
        : pricingLine ?? applyEnrollmentPriceAdjustment(
            { grossCents, netCents: automaticNetCents },
            activeAdjustment
              ? {
                  ...activeAdjustment,
                  final_price_cents: activeAdjustment.finalPriceCents,
                  discount_rule_snapshot: activeAdjustment.discountRuleSnapshot,
                }
              : null,
          )
      const subscription = rawSubscriptionBySignup.get(Number(row.id))
      const fallbackDiscountName = row.manual_discount_reason || 'Automatic discount'
      const rowDiscountComponents = Array.isArray(row.discount_components)
        ? row.discount_components
        : []
      let automaticDiscountComponents = resolved.discountComponents ?? []
      if (automaticDiscountComponents.length === 0 && rowDiscountComponents.length > 0) {
        automaticDiscountComponents = rowDiscountComponents
      }
      if (
        automaticDiscountComponents.length === 0 &&
        grossCents > automaticNetCents
      ) {
        automaticDiscountComponents = [{
          name: fallbackDiscountName,
          amountCents: grossCents - automaticNetCents,
          source: null,
        }]
      }
      const mapped = {
        ...row,
        status: customerEnrollmentStatus(row),
        memberId: group.member.id,
        memberName: group.member.name,
        classCostCents: grossCents,
        automaticDiscountCents: Number(resolved.automaticDiscountCents ?? Math.max(0, grossCents - automaticNetCents)),
        automaticDiscountComponents,
        automaticAdjustedCostCents: Number(resolved.automaticNetCents ?? automaticNetCents),
        manualAdjustmentCents: Number(resolved.manualAdjustmentCents ?? 0),
        adjustedCostCents: resolved.netCents,
        activePriceAdjustment: activeAdjustment,
        priceAdjustments: rowAdjustments,
        nextBillDate: subscription?.next_bill_date ?? null,
        priceSyncStatus: subscription?.price_sync_status ?? 'not_required',
        priceSyncError: subscription?.price_sync_error ?? null,
        stripeSubscriptionScheduleId: subscription?.stripe_subscription_schedule_id ?? null,
      }
      if (row.status === 'waitlisted') waitlists.push(mapped)
      else enrollments.push(mapped)
    }
  }

  const subscriptions = rawSubscriptions.rows.map((row) => {
    const signupId = row.source_type === 'scheduling_signup' ? Number(row.source_id) : null
    const rowAdjustments = Number.isFinite(signupId) ? adjustmentsBySignup.get(signupId) ?? [] : []
    const activeAdjustment = rowAdjustments.find(
      (adjustment) => adjustment.status === 'active' && adjustmentCoversPeriod(adjustment, currentMonth),
    ) ?? null
    const pricingLine = currentPricingBySubscription.get(Number(row.id))
    const fallbackResolved = applyEnrollmentPriceAdjustment(
      {
        grossCents: Number(row.monthly_amount_cents ?? 0),
        netCents: Number(row.net_monthly_cents ?? 0),
      },
      activeAdjustment
        ? {
            ...activeAdjustment,
            final_price_cents: activeAdjustment.finalPriceCents,
            discount_rule_snapshot: activeAdjustment.discountRuleSnapshot,
          }
          : null,
    )
    const resolved = row.status === 'active'
      ? pricingLine ?? fallbackResolved
      : { ...fallbackResolved, netCents: 0, discountCents: Number(row.monthly_amount_cents ?? 0) }
    return {
      id: Number(row.id),
      memberId: row.member_id == null ? null : Number(row.member_id),
      memberName: row.member_name ?? null,
      signupId: Number.isFinite(signupId) ? signupId : null,
      description: row.description,
      status: row.status,
      monthlyAmountCents: Number(row.monthly_amount_cents ?? 0),
      automaticDiscountCents: Number(resolved.automaticDiscountCents ?? 0),
      automaticDiscountComponents: resolved.discountComponents ?? [],
      manualAdjustmentCents: Number(resolved.manualAdjustmentCents ?? 0),
      discountAmountCents: Number(resolved.discountCents ?? 0),
      netMonthlyCents: Number(resolved.netCents ?? 0),
      nextBillDate: row.next_bill_date ?? null,
      startDate: row.start_date ?? null,
      endDate: row.end_date ?? null,
      sourceType: row.source_type,
      sourceId: row.source_id,
      stripeSubscriptionId: row.stripe_subscription_id ?? null,
      stripeSubscriptionScheduleId: row.stripe_subscription_schedule_id ?? null,
      priceSyncStatus: row.price_sync_status ?? 'not_required',
      priceSyncError: row.price_sync_error ?? null,
      activePriceAdjustment: activeAdjustment,
      scheduledPriceAdjustments: rowAdjustments.filter((adjustment) => adjustment.status !== 'revoked'),
    }
  })

  const latestPayment = view.payments?.[0] ?? null
  const nextBillDate = subscriptions
    .filter((subscription) => subscription.status === 'active' && subscription.nextBillDate)
    .map((subscription) => String(subscription.nextBillDate).slice(0, 10))
    .sort()[0] ?? null
  const syncFailures = subscriptions.filter((subscription) => subscription.priceSyncStatus === 'failed')

  return {
    account: mapAccount(account),
    selectedMemberId: selectedMemberId == null ? null : Number(selectedMemberId),
    members,
    summary: {
      chargesCents: view.chargesCents,
      paymentsCents: view.paymentsCents,
      refundsCents: view.refundsCents,
      balanceCents: view.balanceCents,
      monthlyTotals: subscriptions
        .filter((subscription) => subscription.status === 'active')
        .reduce(
          (totals, subscription) => {
            totals.grossCents += subscription.monthlyAmountCents
            totals.discountCents += subscription.discountAmountCents
            totals.netCents += subscription.netMonthlyCents
            return totals
          },
          { grossCents: 0, discountCents: 0, netCents: 0 },
        ),
      nextBillDate,
      latestPayment: latestPayment
        ? {
            id: Number(latestPayment.id),
            amountCents: Number(latestPayment.amount_cents ?? 0),
            paidAt: latestPayment.paid_at,
            method: latestPayment.method ?? null,
          }
        : null,
      stripeSync: syncFailures.length > 0
        ? { status: 'failed', message: `${syncFailures.length} recurring price sync${syncFailures.length === 1 ? '' : 's'} need attention.` }
        : { status: 'healthy', message: 'Local recurring prices are synchronized.' },
    },
    paymentMethod,
    alerts: alertsResult.rows.map((row) => ({
      id: Number(row.id),
      type: row.alert_type,
      severity: row.severity,
      message: row.message,
      stripeObjectId: row.stripe_object_id ?? null,
      createdAt: row.created_at,
    })),
    enrollments,
    waitlists,
    subscriptions,
    adjustments,
    statements: [],
  }
}

function encodeCursor(row) {
  return Buffer.from(JSON.stringify({
    occurredAt: row.occurred_at,
    sortOrder: Number(row.sort_order),
    refId: Number(row.ref_id),
  })).toString('base64url')
}

function decodeCursor(value) {
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'))
    if (!parsed.occurredAt || !Number.isFinite(Number(parsed.sortOrder)) || !Number.isFinite(Number(parsed.refId))) return null
    return parsed
  } catch {
    return null
  }
}

export async function listCustomerBillingTransactions(pool, {
  accountId,
  memberId = null,
  type = null,
  status = null,
  search = null,
  from = null,
  through = null,
  cursor = null,
  limit = 100,
}) {
  const decoded = decodeCursor(cursor)
  const pageSize = Math.min(500, Math.max(1, Number(limit) || 100))
  const result = await pool.query(
    `WITH entries AS (
       SELECT
         'charge'::text AS entry_kind,
         c.charge_type::text AS entry_type,
         c.id::bigint AS ref_id,
         c.member_id::bigint AS member_id,
         c.description::text AS description,
         c.amount_cents::int AS amount_cents,
         c.amount_cents::int AS balance_amount_cents,
         c.created_at::timestamptz AS occurred_at,
         COALESCE(c.collection_status, 'none')::text AS status,
         3::int AS sort_order,
         jsonb_build_object(
           'grossAmountCents', c.gross_amount_cents,
           'discountAmountCents', c.discount_amount_cents,
           'servicePeriodStart', c.service_period_start,
           'servicePeriodEnd', c.service_period_end,
           'sourceType', c.source_type,
           'sourceId', c.source_id,
           'subscriptionId', c.subscription_id,
           'priceAdjustmentId', c.price_adjustment_id,
           'relatedChargeId', c.related_charge_id,
           'stripeCheckoutSessionId', c.stripe_checkout_session_id,
           'stripePaymentIntentId', c.stripe_payment_intent_id,
           'createdByUserId', c.created_by_user_id,
           'metadata', c.metadata
         ) AS details
       FROM billing_charge c WHERE c.family_billing_account_id = $1
       UNION ALL
       SELECT
         'payment', 'payment', p.id, NULL::bigint,
         COALESCE(NULLIF(p.method, ''), 'Payment'),
         -p.amount_cents, -p.amount_cents, p.paid_at,
         COALESCE(p.external_status, 'recorded'), 2,
         jsonb_build_object(
           'note', p.note,
           'externalProcessor', p.external_processor,
           'externalReference', p.external_reference,
           'stripeCustomerId', p.stripe_customer_id,
           'stripePaymentIntentId', p.stripe_payment_intent_id,
           'stripeCheckoutSessionId', p.stripe_checkout_session_id,
           'stripeInvoiceId', p.stripe_invoice_id,
           'recordedByUserId', p.recorded_by_user_id
         )
       FROM billing_payment p WHERE p.family_billing_account_id = $1
       UNION ALL
       SELECT
         'refund', 'refund', r.id, NULL::bigint,
         COALESCE(NULLIF(r.reason, ''), 'Refund'),
         r.amount_cents,
         CASE WHEN COALESCE(r.external_status, 'succeeded') = 'succeeded' THEN r.amount_cents ELSE 0 END,
         r.created_at, COALESCE(r.external_status, 'succeeded'), 1,
         jsonb_build_object(
           'paymentId', r.payment_id,
           'stripeRefundId', r.stripe_refund_id,
           'externalReference', r.external_reference,
           'exceptionCategory', r.exception_category,
           'evidenceNote', r.evidence_note,
           'ledgerTreatment', r.ledger_treatment,
           'relatedChargeId', r.related_charge_id,
           'offsetCreditChargeId', r.offset_credit_charge_id,
           'approvedByUserId', r.approved_by_user_id,
           'errorMessage', r.error_message
         )
       FROM billing_refund r WHERE r.family_billing_account_id = $1
     ), with_balance AS (
       SELECT entries.*,
              SUM(balance_amount_cents) OVER (
                ORDER BY occurred_at, sort_order, ref_id
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) AS running_balance_cents
       FROM entries
     )
     SELECT wb.*, TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS member_name
     FROM with_balance wb
     LEFT JOIN member m ON m.id = wb.member_id
     WHERE ($2::bigint IS NULL OR wb.member_id = $2 OR wb.member_id IS NULL)
       AND ($3::text IS NULL OR wb.entry_kind = $3 OR wb.entry_type = $3)
       AND ($4::text IS NULL OR wb.status = $4)
       AND ($5::text IS NULL OR wb.description ILIKE '%' || $5 || '%' OR wb.ref_id::text = $5)
       AND ($6::date IS NULL OR wb.occurred_at >= $6::date)
       AND ($7::date IS NULL OR wb.occurred_at < $7::date + interval '1 day')
       AND (
         $8::timestamptz IS NULL
         OR (wb.occurred_at, wb.sort_order, wb.ref_id) < ($8::timestamptz, $9::int, $10::bigint)
       )
     ORDER BY wb.occurred_at DESC, wb.sort_order DESC, wb.ref_id DESC
     LIMIT $11`,
    [
      accountId,
      memberId == null ? null : Number(memberId),
      type || null,
      status || null,
      String(search ?? '').trim() || null,
      from || null,
      through || null,
      decoded?.occurredAt ?? null,
      decoded?.sortOrder ?? null,
      decoded?.refId ?? null,
      pageSize + 1,
    ],
  )
  const hasMore = result.rows.length > pageSize
  const rows = result.rows.slice(0, pageSize)
  return {
    rows: rows.map((row) => ({
      entryKind: row.entry_kind,
      entryType: row.entry_type,
      refId: Number(row.ref_id),
      memberId: row.member_id == null ? null : Number(row.member_id),
      memberName: row.member_name ?? null,
      description: row.description,
      amountCents: Number(row.amount_cents),
      occurredAt: row.occurred_at,
      status: row.status,
      runningBalanceCents: Number(row.running_balance_cents),
      details: row.details ?? {},
    })),
    nextCursor: hasMore && rows.length > 0 ? encodeCursor(rows.at(-1)) : null,
  }
}

export async function listCustomerBillingActivity(pool, {
  accountId,
  memberId = null,
  cursor = null,
  limit = 100,
}) {
  const decoded = decodeCursor(cursor)
  const pageSize = Math.min(200, Math.max(1, Number(limit) || 100))
  const result = await pool.query(
    `SELECT a.*, u.full_name AS actor_name
     FROM billing_account_activity a
     LEFT JOIN app_user u ON u.id = a.actor_user_id
     WHERE a.family_billing_account_id = $1
       AND ($2::bigint IS NULL OR a.member_id = $2 OR a.member_id IS NULL)
       AND (
         $3::timestamptz IS NULL
         OR (a.occurred_at, a.id) < ($3::timestamptz, $4::bigint)
       )
     ORDER BY a.occurred_at DESC, a.id DESC
     LIMIT $5`,
    [
      accountId,
      memberId == null ? null : Number(memberId),
      decoded?.occurredAt ?? null,
      decoded?.refId ?? null,
      pageSize + 1,
    ],
  )
  const hasMore = result.rows.length > pageSize
  const rows = result.rows.slice(0, pageSize)
  return {
    rows: rows.map(mapBillingActivity),
    nextCursor: hasMore && rows.length > 0
      ? Buffer.from(JSON.stringify({
          occurredAt: rows.at(-1).occurred_at,
          sortOrder: 0,
          refId: Number(rows.at(-1).id),
        })).toString('base64url')
      : null,
  }
}

function csvCell(value) {
  const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

export async function exportCustomerBillingTransactionsCsv(pool, filters) {
  const allRows = []
  let cursor = null
  do {
    const page = await listCustomerBillingTransactions(pool, {
      ...filters,
      cursor,
      limit: 500,
    })
    allRows.push(...page.rows)
    cursor = page.nextCursor
  } while (cursor)
  const headers = [
    'Date', 'Member', 'Kind', 'Type', 'Reference', 'Description', 'Status',
    'Amount Cents', 'Running Balance Cents', 'Details',
  ]
  return [
    headers.map(csvCell).join(','),
    ...allRows.map((row) => [
      row.occurredAt,
      row.memberName ?? 'Household',
      row.entryKind,
      row.entryType,
      row.refId,
      row.description,
      row.status,
      row.amountCents,
      row.runningBalanceCents,
      row.details,
    ].map(csvCell).join(',')),
  ].join('\n')
}
