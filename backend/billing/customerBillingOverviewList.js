import { buildCanonicalFinancialSnapshot } from './canonicalBillingAccount.js'
import {
  upcomingRecurringPricingMonth,
  loadDefaultPaymentMethodSummary,
} from './customerBillingQueries.js'
import {
  addBillingMonths,
  billingMonthInTimeZone,
} from './customerBillingPricing.js'
import { resolveFamilyEnrollmentPricing } from './familyEnrollmentPricing.js'
import { canonicalActiveHouseholdMemberPredicate } from './householdMembership.js'
import { classifyStripePaymentMethodReadiness } from './stripePaymentMethodReadiness.js'

function cents(value) {
  return Number(value ?? 0) || 0
}

function monthKey(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 7)
  }
  const match = String(value ?? '').match(/^(\d{4}-\d{2})/)
  return match ? match[1] : null
}

export function lastThreeBillingMonths(asOf = new Date(), timeZone = 'America/New_York') {
  const current = billingMonthInTimeZone(asOf, timeZone) ?? String(asOf.toISOString()).slice(0, 7)
  return [3, 2, 1].map((offset) => String(addBillingMonths(current, -offset)).slice(0, 7))
}

export function yearToDateBounds(asOf = new Date(), timeZone = 'America/New_York') {
  const current = billingMonthInTimeZone(asOf, timeZone) ?? String(asOf.toISOString()).slice(0, 7)
  const year = current.slice(0, 4)
  return { year, start: `${year}-01-01`, throughMonth: current }
}

export function familyAutopayStatus({
  householdMonthlyBillingEnabled,
  cardOnFile,
  hasLegacyStripeSubscription,
  hasVerifiedHouseholdMigration,
  effectiveCollectionMonth,
  billingMonth,
  requiresHouseholdAutopay = true,
}) {
  if (hasLegacyStripeSubscription) return 'legacy_collector_conflict'
  if (!requiresHouseholdAutopay) return 'not_applicable'
  if (!householdMonthlyBillingEnabled || !hasVerifiedHouseholdMigration) return 'migration_required'
  const effective = monthKey(effectiveCollectionMonth)
  const target = monthKey(billingMonth)
  if (!effective || !target) return 'migration_required'
  if (!cardOnFile) return 'payment_method_required'
  if (effective > target) return 'scheduled_later'
  return 'ready'
}

export function familyAutopayScheduled(input) {
  return familyAutopayStatus(input) === 'ready'
}

export function paymentMethodReadyForBillingMonth(summary, billingMonth) {
  if (summary?.available !== true) return false
  return classifyStripePaymentMethodReadiness(summary?.paymentMethod, {
    expectedCustomerId: summary?.customerId,
    billingMonth,
  }).ready
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length)
  let next = 0
  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await mapper(items[index], index)
    }
  }))
  return results
}

function groupByAccount(rows, key = 'family_billing_account_id') {
  const grouped = new Map()
  for (const row of rows) {
    const id = Number(row[key])
    if (!Number.isFinite(id)) continue
    const list = grouped.get(id) ?? []
    list.push(row)
    grouped.set(id, list)
  }
  return grouped
}

function monthBillPaid(invoiceRow, chargeCents, paymentCents) {
  if (invoiceRow) {
    const billedCents = cents(invoiceRow.total_cents)
    const paidCents = invoiceRow.status === 'paid'
      ? billedCents
      : Math.min(billedCents, cents(invoiceRow.amount_paid_cents ?? paymentCents))
    return { billedCents, paidCents, source: 'invoice' }
  }
  return {
    billedCents: cents(chargeCents),
    paidCents: cents(paymentCents),
    source: 'ledger',
  }
}

export async function listCustomerBillingOverviews(pool, { facilityId, asOf = new Date() } = {}) {
  const normalizedFacilityId = Number(facilityId)
  if (!Number.isFinite(normalizedFacilityId)) throw new Error('A facility is required.')

  const families = await pool.query(
    `SELECT
       f.id AS family_id,
       f.family_name,
       fba.id AS billing_account_id,
       fba.payer_member_id,
       fba.stripe_customer_id,
       (
         SELECT COUNT(*)::integer
           FROM family_billing_account customer_owner
          WHERE customer_owner.stripe_customer_id = fba.stripe_customer_id
       ) AS stripe_customer_owner_count,
       fba.household_monthly_billing_enabled,
       facility.timezone AS facility_timezone,
       canonical_autopay.id IS NOT NULL AS has_verified_household_migration,
       canonical_autopay.effective_month AS household_collection_effective_month,
       payer.id AS payer_id,
       payer.first_name AS payer_first_name,
       payer.last_name AS payer_last_name,
       first_member.id AS first_member_id
     FROM family f
     JOIN facility ON facility.id = f.facility_id
     LEFT JOIN family_billing_account fba
       ON fba.family_id = f.id AND fba.is_active = TRUE
     LEFT JOIN member payer ON payer.id = fba.payer_member_id
     LEFT JOIN LATERAL (
       SELECT migration.id,
              CASE
                WHEN NULLIF(migration.parity_snapshot ->> 'collectionDeferredToMonth', '') IS NULL
                  THEN migration.cutover_month
                WHEN migration.parity_snapshot ->> 'collectionDeferredToMonth'
                     ~ '^[0-9]{4}-(0[1-9]|1[0-2])-01$'
                  THEN (migration.parity_snapshot ->> 'collectionDeferredToMonth')::date
                ELSE NULL::date
              END AS effective_month
         FROM billing_account_migration migration
         JOIN billing_migration_run run ON run.id = migration.billing_migration_run_id
        WHERE migration.family_billing_account_id = fba.id
          AND migration.state = 'verified'
          AND migration.verified_at IS NOT NULL
          AND migration.target_collection_mode = 'household_monthly'
          AND migration.payer_validation_status = 'verified'
          AND migration.parity_status = 'matched'
          AND migration.household_activated_at IS NOT NULL
          AND migration.snapshot_hash ~ '^[0-9a-f]{64}$'
          AND migration.accepted_snapshot_hash ~ '^[0-9a-f]{64}$'
          AND migration.accepted_baseline_version > 0
          AND migration.accepted_at IS NOT NULL
          AND run.mode = 'apply'
          AND run.status IN ('running', 'completed', 'completed_with_exceptions')
          AND run.migration_key = 'canonical-household-billing-v1'
          AND NULLIF(BTRIM(run.code_version), '') IS NOT NULL
          AND run.manifest_checksum ~ '^[0-9a-f]{64}$'
          AND run.target_month = migration.cutover_month
          AND run.facility_id = f.facility_id
          AND COALESCE(run.configuration -> 'accountIds', '[]'::jsonb)
                @> to_jsonb(ARRAY[fba.id])
        ORDER BY migration.id DESC
        LIMIT 1
     ) canonical_autopay ON TRUE
     LEFT JOIN LATERAL (
       SELECT m.id
         FROM member m
        WHERE ${canonicalActiveHouseholdMemberPredicate({
          memberAlias: 'm',
          familyIdReference: 'f.id',
          membershipAlias: 'overview_first_member',
          historyAlias: 'overview_first_member_history',
        })}
        ORDER BY m.is_active DESC, m.last_name, m.first_name, m.id
        LIMIT 1
     ) first_member ON TRUE
     WHERE f.facility_id = $1
       AND EXISTS (
         SELECT 1
           FROM member household
          WHERE ${canonicalActiveHouseholdMemberPredicate({
            memberAlias: 'household',
            familyIdReference: 'f.id',
            membershipAlias: 'overview_household',
            historyAlias: 'overview_household_history',
          })}
       )
     ORDER BY COALESCE(NULLIF(TRIM(f.family_name), ''), TRIM(CONCAT(payer.last_name, ' ', payer.first_name)), f.id::text),
              f.id`,
    [normalizedFacilityId],
  )

  // A facility endpoint contains families from one facility. Resolve every
  // cutoff and reporting boundary from that facility's configured timezone so
  // the overview agrees with the account page and the billing worker around
  // UTC day boundaries.
  const facilityTimeZone = String(families.rows[0]?.facility_timezone || 'America/New_York')
  const pricingMonth = upcomingRecurringPricingMonth(asOf, facilityTimeZone)
  const months = lastThreeBillingMonths(asOf, facilityTimeZone)
  const { year, start: yearStart } = yearToDateBounds(asOf, facilityTimeZone)
  const monthStart = `${months[0]}-01`
  const currentMonthStart = `${pricingMonth}-01`

  const accountIds = families.rows
    .map((row) => Number(row.billing_account_id))
    .filter((id) => Number.isFinite(id))

  const emptyMonths = () => Object.fromEntries(months.map((month) => [month, { billedCents: 0, paidCents: 0, source: 'none' }]))

  if (accountIds.length === 0) {
    return {
      generatedAt: asOf.toISOString(),
      year,
      months,
      upcomingMonth: pricingMonth,
      families: families.rows.map((row) => serializeFamilyRow(row, {
        yearToDatePaidCents: 0,
        months: emptyMonths(),
        outstandingBalanceCents: 0,
        monthlyRecurringCents: 0,
        futureCreditsCents: 0,
        accountBalanceCents: 0,
        autopay: false,
        cardOnFile: { last4: null, brand: null },
      })),
    }
  }

  const [totalsResult, invoiceResult, monthChargeResult, monthPaymentResult, chargeResult, paymentResult, refundResult, subscriptionResult] = await Promise.all([
    pool.query(
      `SELECT
         account.id AS family_billing_account_id,
         COALESCE((SELECT SUM(charge.amount_cents) FROM billing_charge charge WHERE charge.family_billing_account_id = account.id), 0)::bigint AS charges_cents,
         COALESCE((
           SELECT SUM(payment.amount_cents) FROM billing_payment payment
            WHERE payment.family_billing_account_id = account.id
              AND payment.external_status IN ('settled', 'succeeded')
         ), 0)::bigint AS payments_cents,
         COALESCE((
           SELECT SUM(refund.amount_cents) FROM billing_refund refund
            WHERE refund.family_billing_account_id = account.id
              AND COALESCE(refund.external_status, 'succeeded') = 'succeeded'
         ), 0)::bigint AS refunds_cents,
         COALESCE((
           SELECT SUM(payment.amount_cents) FROM billing_payment payment
            WHERE payment.family_billing_account_id = account.id
              AND payment.external_status IN ('settled', 'succeeded')
              AND payment.paid_at >= $2::date
              AND payment.paid_at < $3::date
         ), 0)::bigint AS year_to_date_paid_cents
       FROM family_billing_account account
      WHERE account.id = ANY($1::bigint[])`,
      [accountIds, yearStart, currentMonthStart],
    ),
    pool.query(
      `SELECT DISTINCT ON (invoice.family_billing_account_id, to_char(invoice.billing_month, 'YYYY-MM'))
         invoice.family_billing_account_id,
         to_char(invoice.billing_month, 'YYYY-MM') AS billing_month,
         invoice.total_cents,
         invoice.status,
         CASE WHEN invoice.status = 'paid' THEN invoice.total_cents ELSE 0 END AS amount_paid_cents
       FROM billing_monthly_invoice invoice
      WHERE invoice.family_billing_account_id = ANY($1::bigint[])
        AND invoice.billing_month >= $2::date
        AND invoice.billing_month < $3::date
        AND invoice.status <> 'void'
      ORDER BY invoice.family_billing_account_id, to_char(invoice.billing_month, 'YYYY-MM'), invoice.id DESC`,
      [accountIds, monthStart, currentMonthStart],
    ),
    pool.query(
      `SELECT charge.family_billing_account_id,
              to_char(COALESCE(charge.service_period_start, charge.created_at::date), 'YYYY-MM') AS billing_month,
              SUM(GREATEST(charge.amount_cents, 0))::bigint AS billed_cents
         FROM billing_charge charge
        WHERE charge.family_billing_account_id = ANY($1::bigint[])
          AND COALESCE(charge.service_period_start, charge.created_at::date) >= $2::date
          AND COALESCE(charge.service_period_start, charge.created_at::date) < $3::date
          AND COALESCE(charge.metadata->>'customerAuditVisibility', '') <> 'suppressed'
        GROUP BY 1, 2`,
      [accountIds, monthStart, currentMonthStart],
    ),
    pool.query(
      `WITH payment_application_totals AS (
         SELECT application.billing_charge_id,
                SUM(CASE
                  WHEN application.application_kind = 'reversal' THEN -application.amount_cents
                  ELSE application.amount_cents
                END)::bigint AS paid_cents
           FROM billing_payment_application application
           JOIN billing_payment payment ON payment.id = application.billing_payment_id
          WHERE payment.family_billing_account_id = ANY($1::bigint[])
            AND payment.external_status IN ('settled', 'succeeded')
          GROUP BY application.billing_charge_id
       ), credit_application_totals AS (
         SELECT target_line.billing_charge_id,
                SUM(application.amount_cents)::bigint AS credit_cents
           FROM billing_charge_credit_application application
           JOIN billing_monthly_invoice_line target_line
             ON target_line.id = application.target_invoice_line_id
           JOIN billing_monthly_invoice invoice
             ON invoice.id = target_line.billing_monthly_invoice_id
          WHERE invoice.family_billing_account_id = ANY($1::bigint[])
          GROUP BY target_line.billing_charge_id
       )
       SELECT charge.family_billing_account_id,
              to_char(COALESCE(charge.service_period_start, charge.created_at::date), 'YYYY-MM') AS billing_month,
              SUM(LEAST(
                GREATEST(charge.amount_cents, 0),
                GREATEST(0, COALESCE(payment.paid_cents, 0) + COALESCE(credit.credit_cents, 0))
              ))::bigint AS paid_cents
         FROM billing_charge charge
         LEFT JOIN payment_application_totals payment ON payment.billing_charge_id = charge.id
         LEFT JOIN credit_application_totals credit ON credit.billing_charge_id = charge.id
        WHERE charge.family_billing_account_id = ANY($1::bigint[])
          AND charge.amount_cents > 0
          AND COALESCE(charge.service_period_start, charge.created_at::date) >= $2::date
          AND COALESCE(charge.service_period_start, charge.created_at::date) < $3::date
          AND COALESCE(charge.metadata->>'customerAuditVisibility', '') <> 'suppressed'
        GROUP BY 1, 2`,
      [accountIds, monthStart, currentMonthStart],
    ),
    pool.query(
      `WITH application_totals AS (
         SELECT application.billing_charge_id,
                SUM(CASE WHEN application.application_kind = 'reversal' THEN -application.amount_cents ELSE application.amount_cents END)::bigint AS applied_cents
           FROM billing_payment_application application
           JOIN billing_charge scoped_charge ON scoped_charge.id = application.billing_charge_id
           JOIN billing_payment settled_payment ON settled_payment.id = application.billing_payment_id
          WHERE scoped_charge.family_billing_account_id = ANY($1::bigint[])
            AND settled_payment.external_status IN ('settled', 'succeeded')
          GROUP BY application.billing_charge_id
       ), credit_application_totals AS (
         SELECT target_line.billing_charge_id,
                SUM(application.amount_cents)::bigint AS applied_cents
           FROM billing_charge_credit_application application
           JOIN billing_monthly_invoice_line target_line ON target_line.id = application.target_invoice_line_id
           JOIN billing_charge scoped_charge ON scoped_charge.id = target_line.billing_charge_id
          WHERE scoped_charge.family_billing_account_id = ANY($1::bigint[])
          GROUP BY target_line.billing_charge_id
       ), credit_source_application_totals AS (
         SELECT credit_line.billing_charge_id,
                SUM(application.amount_cents)::bigint AS allocated_cents
           FROM billing_charge_credit_application application
           JOIN billing_monthly_invoice_line credit_line ON credit_line.id = application.credit_invoice_line_id
           JOIN billing_charge scoped_credit ON scoped_credit.id = credit_line.billing_charge_id
          WHERE scoped_credit.family_billing_account_id = ANY($1::bigint[])
          GROUP BY credit_line.billing_charge_id
       )
       SELECT charge.id,
              charge.family_billing_account_id,
              charge.amount_cents,
              charge.charge_type,
              charge.service_period_start,
              charge.created_at,
              charge.related_charge_id,
              charge.metadata,
              COALESCE(application.applied_cents, 0)::bigint AS applied_amount_cents,
              COALESCE(credit_source_application.allocated_cents, 0)::bigint AS credit_allocated_amount_cents,
              GREATEST(
                0,
                charge.amount_cents
                  - COALESCE(application.applied_cents, 0)
                  - COALESCE(credit_application.applied_cents, 0)
              )::bigint AS remaining_amount_cents
         FROM billing_charge charge
         LEFT JOIN application_totals application ON application.billing_charge_id = charge.id
         LEFT JOIN credit_application_totals credit_application ON credit_application.billing_charge_id = charge.id
         LEFT JOIN credit_source_application_totals credit_source_application ON credit_source_application.billing_charge_id = charge.id
        WHERE charge.family_billing_account_id = ANY($1::bigint[])
          AND (
            charge.amount_cents < 0
            OR GREATEST(0, charge.amount_cents - COALESCE(application.applied_cents, 0) - COALESCE(credit_application.applied_cents, 0)) > 0
            OR (
              charge.charge_type = 'recurring'
              AND to_char(COALESCE(charge.service_period_start, charge.created_at::date), 'YYYY-MM') = $2
            )
          )`,
      [accountIds, pricingMonth],
    ),
    pool.query(
      `WITH application_totals AS (
         SELECT application.billing_payment_id,
                SUM(CASE WHEN application.application_kind = 'reversal' THEN -application.amount_cents ELSE application.amount_cents END)::bigint AS applied_cents
           FROM billing_payment_application application
           JOIN billing_payment scoped_payment ON scoped_payment.id = application.billing_payment_id
          WHERE scoped_payment.family_billing_account_id = ANY($1::bigint[])
            AND scoped_payment.external_status IN ('settled', 'succeeded')
          GROUP BY application.billing_payment_id
       ), refund_totals AS (
         SELECT refund.payment_id, SUM(refund.amount_cents)::bigint AS refunded_cents
           FROM billing_refund refund
          WHERE refund.family_billing_account_id = ANY($1::bigint[])
            AND COALESCE(refund.external_status, 'succeeded') IN ('pending', 'succeeded')
          GROUP BY refund.payment_id
       )
       SELECT payment.id,
              payment.family_billing_account_id,
              payment.amount_cents,
              GREATEST(
                0,
                payment.amount_cents
                  - COALESCE(application.applied_cents, 0)
                  - COALESCE(refund.refunded_cents, 0)
              )::bigint AS remaining_amount_cents
         FROM billing_payment payment
         LEFT JOIN application_totals application ON application.billing_payment_id = payment.id
         LEFT JOIN refund_totals refund ON refund.payment_id = payment.id
        WHERE payment.family_billing_account_id = ANY($1::bigint[])
          AND payment.external_status IN ('settled', 'succeeded')
          AND GREATEST(0, payment.amount_cents - COALESCE(application.applied_cents, 0) - COALESCE(refund.refunded_cents, 0)) > 0`,
      [accountIds],
    ),
    pool.query(
      `SELECT family_billing_account_id, COALESCE(SUM(amount_cents), 0)::bigint AS refunds_cents
         FROM billing_refund
        WHERE family_billing_account_id = ANY($1::bigint[])
          AND COALESCE(external_status, 'succeeded') = 'succeeded'
        GROUP BY family_billing_account_id`,
      [accountIds],
    ),
    pool.query(
      `SELECT id, family_billing_account_id, status, net_monthly_cents, discount_amount_cents,
              source_type, pricing_option_key, stripe_subscription_id,
              stripe_subscription_item_id, stripe_subscription_schedule_id
         FROM billing_subscription
        WHERE family_billing_account_id = ANY($1::bigint[])
          AND status IN ('active', 'paused')`,
      [accountIds],
    ),
  ])

  const totalsByAccount = new Map(totalsResult.rows.map((row) => [Number(row.family_billing_account_id), row]))
  const invoicesByAccount = groupByAccount(invoiceResult.rows)
  const chargesByMonth = groupByAccount(monthChargeResult.rows)
  const paymentsByMonth = groupByAccount(monthPaymentResult.rows)
  const remainingCharges = groupByAccount(chargeResult.rows)
  const unappliedPayments = groupByAccount(paymentResult.rows)
  const refundsByAccount = new Map(refundResult.rows.map((row) => [Number(row.family_billing_account_id), cents(row.refunds_cents)]))
  const collectorSubscriptionsByAccount = groupByAccount(subscriptionResult.rows)
  const subscriptionsByAccount = groupByAccount(
    subscriptionResult.rows.filter((subscription) => subscription.status === 'active'),
  )

  const monthLookup = (rows, accountId, month, field) => {
    const list = rows.get(accountId) ?? []
    const match = list.find((row) => monthKey(row.billing_month) === month)
    return match ? cents(match[field]) : 0
  }

  const snapshots = new Map()
  for (const accountId of accountIds) {
    const totals = totalsByAccount.get(accountId) ?? {}
    const subscriptions = subscriptionsByAccount.get(accountId) ?? []
    snapshots.set(accountId, buildCanonicalFinancialSnapshot({
      totals: {
        chargesCents: cents(totals.charges_cents),
        paymentsCents: cents(totals.payments_cents),
        refundsCents: cents(totals.refunds_cents ?? refundsByAccount.get(accountId)),
      },
      charges: remainingCharges.get(accountId) ?? [],
      payments: unappliedPayments.get(accountId) ?? [],
      subscriptions,
      recurringBillingMonth: pricingMonth,
    }))
  }

  const recurringByFamily = new Map()
  await mapLimit(families.rows, 6, async (row) => {
    try {
      const priced = await resolveFamilyEnrollmentPricing(pool, {
        familyId: Number(row.family_id),
        periodKey: pricingMonth,
        subscriptions: subscriptionsByAccount.get(Number(row.billing_account_id)) ?? [],
      })
      recurringByFamily.set(Number(row.family_id), cents(priced.netCents))
    } catch (error) {
      console.warn('[customer-billing] overview recurring pricing failed', {
        familyId: row.family_id,
        message: error?.message,
      })
      recurringByFamily.set(Number(row.family_id), 0)
    }
  })

  const cardsByAccount = new Map()
  await mapLimit(families.rows.filter((row) => row.stripe_customer_id), 5, async (row) => {
    try {
      const effectiveCollectionMonth = monthKey(row.household_collection_effective_month)
      const requiredPaymentMethodMonth = [pricingMonth, effectiveCollectionMonth]
        .filter(Boolean)
        .sort()
        .at(-1)
      const summary = await loadDefaultPaymentMethodSummary(row, {
        billingMonth: requiredPaymentMethodMonth,
      })
      cardsByAccount.set(Number(row.billing_account_id), summary)
    } catch {
      cardsByAccount.set(Number(row.billing_account_id), { available: false, paymentMethod: null })
    }
  })

  return {
    generatedAt: asOf.toISOString(),
    year,
    months,
    upcomingMonth: pricingMonth,
    families: families.rows.map((row) => {
      const accountId = Number(row.billing_account_id)
      const snapshot = snapshots.get(accountId)
      const totals = totalsByAccount.get(accountId) ?? {}
      const invoiceRows = invoicesByAccount.get(accountId) ?? []
      const monthValues = Object.fromEntries(months.map((month) => {
        const invoice = invoiceRows.find((item) => monthKey(item.billing_month) === month)
        return [month, monthBillPaid(
          invoice,
          monthLookup(chargesByMonth, accountId, month, 'billed_cents'),
          monthLookup(paymentsByMonth, accountId, month, 'paid_cents'),
        )]
      }))
      const paymentMethod = cardsByAccount.get(accountId)
      const last4 = paymentMethod?.paymentMethod?.last4 ?? null
      const householdMonthlyBillingEnabled = row.household_monthly_billing_enabled === true
      const hasLegacyStripeSubscription = (collectorSubscriptionsByAccount.get(accountId) ?? [])
        .some((subscription) => Boolean(
          subscription.stripe_subscription_id
          || subscription.stripe_subscription_item_id
          || subscription.stripe_subscription_schedule_id,
        ))
      const effectiveCollectionMonth = monthKey(row.household_collection_effective_month)
      const requiredPaymentMethodMonth = [pricingMonth, effectiveCollectionMonth]
        .filter(Boolean)
        .sort()
        .at(-1)
      const autopayStatus = familyAutopayStatus({
        householdMonthlyBillingEnabled,
        cardOnFile: paymentMethodReadyForBillingMonth(paymentMethod, requiredPaymentMethodMonth),
        hasLegacyStripeSubscription,
        hasVerifiedHouseholdMigration: row.has_verified_household_migration === true,
        effectiveCollectionMonth,
        billingMonth: billingMonthInTimeZone(asOf, row.facility_timezone),
        // This column reflects payment collection for current recurring
        // tuition. Historical balances and inactive households do not need a
        // household-autopay migration merely to appear in the overview.
        requiresHouseholdAutopay: (recurringByFamily.get(Number(row.family_id)) ?? 0) > 0,
      })
      return serializeFamilyRow(row, {
        yearToDatePaidCents: cents(totals.year_to_date_paid_cents),
        months: monthValues,
        outstandingBalanceCents: snapshot?.outstandingBalanceCents ?? 0,
        monthlyRecurringCents: recurringByFamily.get(Number(row.family_id)) ?? 0,
        futureCreditsCents: snapshot?.futureCreditsCents ?? 0,
        accountBalanceCents: snapshot?.balanceCents ?? 0,
        autopay: autopayStatus === 'ready',
        autopayStatus,
        autopayEffectiveMonth: effectiveCollectionMonth,
        cardOnFile: {
          last4,
          brand: paymentMethod?.paymentMethod?.brand ?? null,
        },
      })
    }),
  }
}

function serializeFamilyRow(row, metrics) {
  const payerName = [row.payer_first_name, row.payer_last_name].filter(Boolean).join(' ').trim()
  return {
    familyId: Number(row.family_id),
    familyName: String(row.family_name ?? '').trim() || payerName || `Family ${row.family_id}`,
    billingAccountId: row.billing_account_id == null ? null : Number(row.billing_account_id),
    payerMemberId: row.payer_id == null ? null : Number(row.payer_id),
    memberId: Number(row.payer_id ?? row.first_member_id ?? 0) || null,
    yearToDatePaidCents: metrics.yearToDatePaidCents,
    months: metrics.months,
    outstandingBalanceCents: metrics.outstandingBalanceCents,
    monthlyRecurringCents: metrics.monthlyRecurringCents,
    futureCreditsCents: metrics.futureCreditsCents,
    accountBalanceCents: metrics.accountBalanceCents,
    autopay: metrics.autopay,
    autopayStatus: metrics.autopayStatus ?? 'migration_required',
    autopayEffectiveMonth: metrics.autopayEffectiveMonth ?? null,
    cardOnFile: metrics.cardOnFile,
  }
}
